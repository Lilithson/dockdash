package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os/exec"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"
)

// DockerClient wraps the Docker Engine API client.
type DockerClient struct {
	cli *client.Client
}

// NewDockerClient creates a new DockerClient connected to the local Docker socket.
func NewDockerClient() (*DockerClient, error) {
	cli, err := client.NewClientWithOpts(
		client.FromEnv,
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, fmt.Errorf("create docker client: %w", err)
	}
	return &DockerClient{cli: cli}, nil
}

// ContainerSummary is a simplified view of a container for list responses.
type ContainerSummary struct {
	ID      string            `json:"id"`
	Names   []string          `json:"names"`
	Image   string            `json:"image"`
	Status  string            `json:"status"`
	State   string            `json:"state"`
	Created int64             `json:"created"`
	Ports   []types.Port      `json:"ports"`
	Labels  map[string]string `json:"labels"`
}

// ListContainers returns all containers (all=true includes stopped).
func (d *DockerClient) ListContainers(ctx context.Context, all bool) ([]ContainerSummary, error) {
	containers, err := d.cli.ContainerList(ctx, container.ListOptions{All: all})
	if err != nil {
		return nil, err
	}
	result := make([]ContainerSummary, len(containers))
	for i, c := range containers {
		result[i] = ContainerSummary{
			ID:      c.ID,
			Names:   c.Names,
			Image:   c.Image,
			Status:  c.Status,
			State:   c.State,
			Created: c.Created,
			Ports:   c.Ports,
			Labels:  c.Labels,
		}
	}
	return result, nil
}

// InspectContainer returns detailed info about a container.
func (d *DockerClient) InspectContainer(ctx context.Context, id string) (types.ContainerJSON, error) {
	return d.cli.ContainerInspect(ctx, id)
}

// StartContainer starts a container.
func (d *DockerClient) StartContainer(ctx context.Context, id string) error {
	return d.cli.ContainerStart(ctx, id, container.StartOptions{})
}

// StopContainer stops a container (10-second timeout).
func (d *DockerClient) StopContainer(ctx context.Context, id string) error {
	timeout := 10
	return d.cli.ContainerStop(ctx, id, container.StopOptions{Timeout: &timeout})
}

// RestartContainer restarts a container.
func (d *DockerClient) RestartContainer(ctx context.Context, id string) error {
	timeout := 10
	return d.cli.ContainerRestart(ctx, id, container.StopOptions{Timeout: &timeout})
}

// RemoveContainer removes a container.
func (d *DockerClient) RemoveContainer(ctx context.Context, id string, force bool) error {
	return d.cli.ContainerRemove(ctx, id, container.RemoveOptions{Force: force})
}

// ContainerLogs returns a reader for the last 100 lines of container logs.
func (d *DockerClient) ContainerLogs(ctx context.Context, id string) (io.ReadCloser, error) {
	return d.cli.ContainerLogs(ctx, id, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Tail:       "100",
		Timestamps: true,
	})
}

// ImageSummary is a simplified view of an image.
type ImageSummary struct {
	ID      string            `json:"id"`
	Tags    []string          `json:"tags"`
	Size    int64             `json:"size"`
	Created int64             `json:"created"`
	Labels  map[string]string `json:"labels"`
}

// ListImages returns all images.
func (d *DockerClient) ListImages(ctx context.Context) ([]ImageSummary, error) {
	images, err := d.cli.ImageList(ctx, image.ListOptions{All: false})
	if err != nil {
		return nil, err
	}
	result := make([]ImageSummary, len(images))
	for i, img := range images {
		result[i] = ImageSummary{
			ID:      img.ID,
			Tags:    img.RepoTags,
			Size:    img.Size,
			Created: img.Created,
			Labels:  img.Labels,
		}
	}
	return result, nil
}

// PullImage pulls an image and returns a stream of progress events.
func (d *DockerClient) PullImage(ctx context.Context, ref string) (io.ReadCloser, error) {
	return d.cli.ImagePull(ctx, ref, image.PullOptions{})
}

// RemoveImage removes an image.
func (d *DockerClient) RemoveImage(ctx context.Context, id string, force bool) ([]image.DeleteResponse, error) {
	return d.cli.ImageRemove(ctx, id, image.RemoveOptions{Force: force})
}

// InspectImage returns detailed info about an image.
func (d *DockerClient) InspectImage(ctx context.Context, id string) (types.ImageInspect, error) {
	info, _, err := d.cli.ImageInspectWithRaw(ctx, id)
	return info, err
}

// ContainerStats holds parsed CPU and memory statistics for a container.
type ContainerStats struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	CPUPercent  float64 `json:"cpu_percent"`
	MemUsage    uint64  `json:"mem_usage"`
	MemLimit    uint64  `json:"mem_limit"`
	MemPercent  float64 `json:"mem_percent"`
}

// GetContainerStats reads one stats snapshot for the given container ID.
func (d *DockerClient) GetContainerStats(ctx context.Context, id string) (*ContainerStats, error) {
	resp, err := d.cli.ContainerStats(ctx, id, false)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var raw types.StatsJSON
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}

	cpuPercent := calculateCPUPercent(&raw)
	memUsage := raw.MemoryStats.Usage - raw.MemoryStats.Stats["cache"]
	memLimit := raw.MemoryStats.Limit
	var memPercent float64
	if memLimit > 0 {
		memPercent = float64(memUsage) / float64(memLimit) * 100.0
	}

	name := raw.Name
	if len(name) > 0 && name[0] == '/' {
		name = name[1:]
	}

	return &ContainerStats{
		ID:         id,
		Name:       name,
		CPUPercent: math.Round(cpuPercent*100) / 100,
		MemUsage:   memUsage,
		MemLimit:   memLimit,
		MemPercent: math.Round(memPercent*100) / 100,
	}, nil
}

func calculateCPUPercent(stats *types.StatsJSON) float64 {
	cpuDelta := float64(stats.CPUStats.CPUUsage.TotalUsage) - float64(stats.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(stats.CPUStats.SystemUsage) - float64(stats.PreCPUStats.SystemUsage)
	numCPUs := float64(stats.CPUStats.OnlineCPUs)
	if numCPUs == 0 {
		numCPUs = float64(len(stats.CPUStats.CPUUsage.PercpuUsage))
	}
	if systemDelta > 0 && cpuDelta > 0 {
		return (cpuDelta / systemDelta) * numCPUs * 100.0
	}
	return 0
}

// HostInfo holds summary information about the Docker host.
type HostInfo struct {
	TotalContainers int    `json:"total_containers"`
	RunningContainers int  `json:"running_containers"`
	TotalImages     int    `json:"total_images"`
	DockerVersion   string `json:"docker_version"`
	OS              string `json:"os"`
	Arch            string `json:"arch"`
	KernelVersion   string `json:"kernel_version"`
	MemTotal        int64  `json:"mem_total"`
}

// GetHostInfo returns summary information about the Docker host.
func (d *DockerClient) GetHostInfo(ctx context.Context) (*HostInfo, error) {
	info, err := d.cli.Info(ctx)
	if err != nil {
		return nil, err
	}
	return &HostInfo{
		TotalContainers:   info.Containers,
		RunningContainers: info.ContainersRunning,
		TotalImages:       info.Images,
		DockerVersion:     info.ServerVersion,
		OS:                info.OperatingSystem,
		Arch:              info.Architecture,
		KernelVersion:     info.KernelVersion,
		MemTotal:          info.MemTotal,
	}, nil
}

// ComposeUp deploys a docker-compose stack using the CLI.
func (d *DockerClient) ComposeUp(name, composePath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(ctx, "docker", "compose", "-p", name, "-f", composePath, "up", "-d", "--remove-orphans")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("compose up: %w: %s", err, string(out))
	}
	return nil
}

// ComposeDown destroys a docker-compose stack using the CLI.
func (d *DockerClient) ComposeDown(name, composePath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, "docker", "compose", "-p", name, "-f", composePath, "down")
	out, err := cmd.CombinedOutput()
	if err != nil {
		// Compose file may be gone; fall back to removing containers by label.
		f := filters.NewArgs()
		f.Add("label", "com.docker.compose.project="+name)
		containers, listErr := d.cli.ContainerList(ctx, container.ListOptions{All: true, Filters: f})
		if listErr == nil {
			for _, c := range containers {
				_ = d.cli.ContainerRemove(ctx, c.ID, container.RemoveOptions{Force: true})
			}
			return nil
		}
		return fmt.Errorf("compose down: %w: %s", err, string(out))
	}
	return nil
}
