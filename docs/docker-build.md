# Multi-Platform Docker Builds

This document describes the GitHub Actions workflow for building and pushing multi-platform Docker images.

## Overview

The workflow (`.github/workflows/docker-publish.yml`) builds Docker images for both **linux/amd64** and **linux/arm64** platforms using Docker Buildx, then pushes them to Docker Hub.

## Triggers

The workflow runs on:
- **Push to `main` or `develop` branches** - Builds and pushes images
- **Git tags (v\*)** - Builds and pushes versioned images (e.g., `v1.0.0`)
- **Pull requests** - Builds images without pushing (for testing)
- **Manual dispatch** - Can be triggered manually from GitHub Actions UI

## Required Secrets

Before using this workflow, you need to configure the following secrets in your GitHub repository:

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add the following secrets:

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username | Your Docker Hub account username |
| `DOCKERHUB_TOKEN` | Docker Hub access token | [Create a token](https://hub.docker.com/settings/security) in Docker Hub settings |

### Creating a Docker Hub Token

1. Log in to [Docker Hub](https://hub.docker.com)
2. Go to **Account Settings** → **Security**
3. Click **New Access Token**
4. Choose **Read, Write, Delete** permissions
5. Copy the token and add it as `DOCKERHUB_TOKEN` in GitHub secrets

## Image Tags

The workflow automatically generates tags based on the trigger:

### Branch Push
- `main` branch → `<image>:main`, `<image>:latest`
- `develop` branch → `<image>:develop`

### Git Tags
- Tag `v1.2.3` → `<image>:1.2.3`, `<image>:1.2`, `<image>:latest` (if main)

### Pull Requests
- PR #123 → `<image>:pr-123` (built but not pushed)

## Platforms Supported

Both backend and frontend images are built for:
- **linux/amd64** - Standard x86_64 architecture
- **linux/arm64** - ARM64/Apple Silicon/Raspberry Pi

## Local Testing

To test multi-platform builds locally (requires Docker Buildx):

```bash
# Create buildx builder
docker buildx create --name multiarch --driver docker-container --use

# Build for multiple platforms (without pushing)
docker buildx build --platform linux/amd64,linux/arm64 -t test/kubelab-backend:latest ./backend

# Build and push
docker buildx build --platform linux/amd64,linux/arm64 \
  -t yourusername/kubelab-backend:latest \
  --push ./backend
```

## Workflow Features

### 1. **Multi-Platform Support**
Uses QEMU and Docker Buildx to build images for multiple architectures simultaneously.

### 2. **GitHub Actions Cache**
Leverages GitHub Actions cache for faster builds by caching Docker layers.

### 3. **Automatic Tagging**
Uses `docker/metadata-action` to automatically generate appropriate tags based on git refs.

### 4. **Pull Request Validation**
Builds images on PRs without pushing to validate the build succeeds.

### 5. **Security**
Uses Docker Hub tokens instead of passwords, with secrets stored securely in GitHub.

## Manual Workflow Dispatch

You can manually trigger the workflow from the GitHub Actions UI:

1. Go to **Actions** tab in your repository
2. Select **"Docker Build and Push"** workflow
3. Click **"Run workflow"**
4. Choose branch and whether to push images
5. Click **"Run workflow"**

## Updating Kubernetes Manifests

After pushing new images, update your Kubernetes manifests:

```bash
# Update backend image
sed -i '' "s|image: .*/kubelab-backend:.*|image: YOUR_USERNAME/kubelab-backend:latest|" k8s/base/backend.yaml

# Update frontend image
sed -i '' "s|image: .*/kubelab-frontend:.*|image: YOUR_USERNAME/kubelab-frontend:latest|" k8s/base/frontend.yaml

# Or use the update-manifests script
./scripts/update-manifests.sh YOUR_USERNAME latest
```

## Troubleshooting

### Build fails with "no space left on device"
- GitHub Actions runners have limited disk space
- The workflow uses cache to optimize builds
- If issue persists, consider cleaning up old Docker images

### QEMU emulation is slow
- ARM64 builds use QEMU emulation on x86_64 runners
- This is normal and expected
- Builds typically complete in 5-10 minutes

### Docker Hub rate limits
- Authenticated requests have higher rate limits
- Using Docker Hub tokens helps avoid anonymous rate limits

### Missing secrets error
- Ensure `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` are set in repository secrets
- Check secret names match exactly (case-sensitive)

## Comparison with Manual Build

| Feature | Manual Script | GitHub Actions |
|---------|--------------|----------------|
| Multi-platform | Single arch only | ✅ amd64 + arm64 |
| Automation | Manual trigger | ✅ Auto on push/PR |
| Caching | None | ✅ GitHub cache |
| Token security | Interactive login | ✅ Encrypted secrets |
| PR validation | No | ✅ Builds on PRs |
| Version tagging | Manual | ✅ Automatic |

## Related Files

- `.github/workflows/docker-publish.yml` - Main workflow definition
- `backend/Dockerfile` - Backend image definition
- `frontend/Dockerfile` - Frontend image definition
- `scripts/build-and-push.sh` - Manual single-arch build script
- `setup/docker-setup.md` - Docker setup documentation

## Resources

- [Docker Buildx documentation](https://docs.docker.com/build/buildx/)
- [Multi-platform images](https://docs.docker.com/build/building/multi-platform/)
- [GitHub Actions Docker workflow](https://docs.github.com/en/actions/publishing-packages/publishing-docker-images)
