#!/bin/bash

# Docker build script for carrier-poc
# Builds all applications in the apps/ directory and pushes to local registry

set -e  # Exit on any error

# Configuration
REGISTRY="localhost:5001"
TAG="latest"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if local registry is running
check_registry() {
    print_status "Checking if local registry is accessible..."
    if curl -f http://localhost:5001/v2/ > /dev/null 2>&1; then
        print_success "Local registry is accessible at localhost:5001"
    else
        print_warning "Local registry at localhost:5001 is not accessible"
        print_warning "Make sure to start your local registry first:"
        print_warning "docker run -d -p 5001:5000 --name registry registry:2"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Function to build and push a single app
build_and_push_app() {
    local app_name=$1
    local app_path="apps/${app_name}"
    
    if [ ! -f "${app_path}/Dockerfile.standalone" ]; then
        print_error "Dockerfile not found in ${app_path}"
        return 1
    fi
    
    print_status "Building ${app_name}..."
    
    # Build the Docker image
    docker build -f "${app_path}/Dockerfile.standalone" -t "${app_name}:${TAG}" .

    if [ $? -eq 0 ]; then
        print_success "Successfully built ${app_name}:${TAG}"
    else
        print_error "Failed to build ${app_name}"
        return 1
    fi
    
    # Tag for registry
    docker tag "${app_name}:${TAG}" "${REGISTRY}/${app_name}:${TAG}"
    
    print_status "Pushing ${app_name} to registry..."
    
    # Push to registry
    docker push "${REGISTRY}/${app_name}:${TAG}"
    
    if [ $? -eq 0 ]; then
        print_success "Successfully pushed ${REGISTRY}/${app_name}:${TAG}"
    else
        print_error "Failed to push ${app_name} to registry"
        return 1
    fi
}

# Main execution
main() {
    print_status "Starting Docker build process for carrier-poc"
    print_status "Registry: ${REGISTRY}"
    print_status "Tag: ${TAG}"
    echo
    
    # Check if registry is accessible
    check_registry
    echo
    
    # Get list of apps
    apps=($(ls -d apps/*/ 2>/dev/null | sed 's|apps/||g' | sed 's|/||g'))
    
    if [ ${#apps[@]} -eq 0 ]; then
        print_error "No applications found in apps/ directory"
        exit 1
    fi
    
    print_status "Found applications: ${apps[*]}"
    echo
    
    # Build and push each app
    failed_apps=()
    successful_apps=()
    
    for app in "${apps[@]}"; do
        echo "----------------------------------------"
        if build_and_push_app "${app}"; then
            successful_apps+=("${app}")
        else
            failed_apps+=("${app}")
        fi
        echo
    done
    
    # Summary
    echo "========================================"
    print_status "Build Summary"
    echo "========================================"
    
    if [ ${#successful_apps[@]} -gt 0 ]; then
        print_success "Successfully built and pushed:"
        for app in "${successful_apps[@]}"; do
            echo "  - ${REGISTRY}/${app}:${TAG}"
        done
    fi
    
    if [ ${#failed_apps[@]} -gt 0 ]; then
        print_error "Failed to build/push:"
        for app in "${failed_apps[@]}"; do
            echo "  - ${app}"
        done
        echo
        print_error "Build completed with errors"
        exit 1
    else
        echo
        print_success "All applications built and pushed successfully!"
        print_status "You can now use these images in your deployments"
    fi
}

# Run main function
main "$@"