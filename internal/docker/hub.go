package docker

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

const hubBaseURL = "https://hub.docker.com/v2"

var hubHTTPClient = &http.Client{Timeout: 15 * time.Second}

// HubSearchResult represents one result from Docker Hub search.
type HubSearchResult struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	StarCount   int    `json:"star_count"`
	PullCount   int64  `json:"pull_count"`
	IsOfficial  bool   `json:"is_official"`
}

// HubTag represents a single image tag from Docker Hub.
type HubTag struct {
	Name        string    `json:"name"`
	FullSize    int64     `json:"full_size"`
	LastUpdated time.Time `json:"last_updated"`
}

// SearchImages queries Docker Hub for images matching the given query.
func SearchImages(query string, limit int) ([]HubSearchResult, error) {
	if limit <= 0 {
		limit = 25
	}
	endpoint := fmt.Sprintf("%s/search/repositories/?query=%s&page_size=%d",
		hubBaseURL, url.QueryEscape(query), limit)

	resp, err := hubHTTPClient.Get(endpoint)
	if err != nil {
		return nil, fmt.Errorf("hub search: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("hub search: unexpected status %d", resp.StatusCode)
	}

	var body struct {
		Results []struct {
			RepoName    string `json:"repo_name"`
			ShortDesc   string `json:"short_description"`
			StarCount   int    `json:"star_count"`
			PullCount   int64  `json:"pull_count"`
			IsOfficial  bool   `json:"is_official"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("hub search decode: %w", err)
	}

	results := make([]HubSearchResult, len(body.Results))
	for i, r := range body.Results {
		results[i] = HubSearchResult{
			Name:        r.RepoName,
			Description: r.ShortDesc,
			StarCount:   r.StarCount,
			PullCount:   r.PullCount,
			IsOfficial:  r.IsOfficial,
		}
	}
	return results, nil
}

// GetTags returns the tags for the given image (page is 1-indexed).
func GetTags(imageName string, page int) ([]HubTag, error) {
	if page <= 0 {
		page = 1
	}
	endpoint := fmt.Sprintf("%s/repositories/%s/tags/?page=%d&page_size=25",
		hubBaseURL, imageName, page)

	resp, err := hubHTTPClient.Get(endpoint)
	if err != nil {
		return nil, fmt.Errorf("hub tags: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("hub tags: unexpected status %d", resp.StatusCode)
	}

	var body struct {
		Results []struct {
			Name        string    `json:"name"`
			FullSize    int64     `json:"full_size"`
			LastUpdated time.Time `json:"last_updated"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("hub tags decode: %w", err)
	}

	tags := make([]HubTag, len(body.Results))
	for i, t := range body.Results {
		tags[i] = HubTag{
			Name:        t.Name,
			FullSize:    t.FullSize,
			LastUpdated: t.LastUpdated,
		}
	}
	return tags, nil
}
