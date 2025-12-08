# Release Process

This document describes the manual release process for publishing `@squeakyrobot/fsrs` to npm.

## Prerequisites

### One-Time Setup

1. **NPM Account Configuration**
   ```bash
   # Login to npm locally
   npm login

   # Verify authentication
   npm whoami
   ```

2. **Generate NPM Automation Token**
   - Visit: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click **"Generate New Token"** → Select **"Automation"**
   - Copy the token

3. **Add NPM Token to GitHub Secrets**
   - Go to: https://github.com/squeakyrobot/fsrs/settings/secrets/actions
   - Click **"New repository secret"**
   - Name: `NPM_TOKEN`
   - Value: Paste your npm automation token
   - Click **"Add secret"**

## Release Workflow

### Step 1: Prepare Your Changes

Ensure all changes for the release are merged into a feature branch and tested:

```bash
# Make sure all tests pass
npm test

# Verify the build works
npm run build

# Optional: Test the package locally
npm pack
# This creates a .tgz file you can test install
```

### Step 2: Update Version

Before merging your branch to main, update the version in package.json:

```bash
# For patch releases (1.0.0 → 1.0.1) - bug fixes
npm version patch

# For minor releases (1.0.0 → 1.1.0) - new features
npm version minor

# For major releases (1.0.0 → 2.0.0) - breaking changes
npm version major
```

**What `npm version` does:**
- Runs tests automatically (via `preversion` script)
- Updates version in package.json
- Rebuilds the package (via `version` script)
- Creates a git commit with message "vX.X.X"
- Creates a git tag "vX.X.X"

### Step 3: Push Version Commit and Tag

```bash
# Push the version commit
git push origin your-branch-name

# Push the tag
git push origin --tags
```

### Step 4: Create Pull Request and Merge

1. Create a pull request from your branch to `main`
2. Wait for CI checks to pass
3. Merge the pull request to `main`

### Step 5: Create GitHub Release

1. Go to: https://github.com/squeakyrobot/fsrs/releases/new
2. Click **"Choose a tag"** → Select the version tag you created (e.g., `v1.0.1`)
3. **Release title**: Use the version number (e.g., `v1.0.1`)
4. **Description**: Add release notes describing changes
   ```markdown
   ## What's Changed
   - Fixed bug in X
   - Improved Y performance
   - Updated Z documentation

   ## Breaking Changes (if any)
   - None
   ```
5. Click **"Publish release"**

### Step 6: Automated Publishing

Once you publish the GitHub release:
- GitHub Actions automatically triggers the release workflow
- The workflow runs tests and builds the package
- The package publishes to npm with provenance
- Monitor the workflow: https://github.com/squeakyrobot/fsrs/actions

### Step 7: Verify Publication

```bash
# Check npm registry (may take a minute to update)
npm view @squeakyrobot/fsrs

# Verify the new version is live
npm view @squeakyrobot/fsrs version
```

## Quick Reference

### Version Bump Commands

```bash
npm version patch    # 1.0.0 → 1.0.1 (bug fixes)
npm version minor    # 1.0.0 → 1.1.0 (new features, backwards compatible)
npm version major    # 1.0.0 → 2.0.0 (breaking changes)
```

### Pre-Release Versions

For beta or alpha releases:

```bash
npm version prepatch  # 1.0.0 → 1.0.1-0
npm version preminor  # 1.0.0 → 1.1.0-0
npm version premajor  # 1.0.0 → 2.0.0-0
npm version prerelease # 1.0.1-0 → 1.0.1-1
```

## Safety Features

The package.json includes safety scripts that automatically run:

- **`preversion`**: Runs tests before version bump
- **`version`**: Rebuilds package after version bump
- **`prepublishOnly`**: Runs build and tests before any publish

These scripts prevent publishing broken code.

## Troubleshooting

### Version bump failed
- Check that tests pass: `npm test`
- Ensure you have no uncommitted changes
- Verify you're on the correct branch

### GitHub Actions publish failed
- Check the workflow logs: https://github.com/squeakyrobot/fsrs/actions
- Verify `NPM_TOKEN` secret is set correctly
- Ensure the version in package.json doesn't already exist on npm

### Package not appearing on npm
- Wait 1-2 minutes for npm registry to update
- Check for errors in GitHub Actions workflow
- Verify package name is available: https://www.npmjs.com/package/@squeakyrobot/fsrs

## First Release Checklist

Before publishing v1.0.0, verify:

- [ ] All tests pass
- [ ] Documentation is complete
- [ ] README.md has installation and usage instructions
- [ ] LICENSE file is present
- [ ] package.json metadata is correct (author, repository, keywords)
- [ ] NPM_TOKEN is configured in GitHub secrets
- [ ] You've tested the package locally with `npm pack`
- [ ] You've run `npm publish --dry-run` to verify package contents

## Example Release Flow

```bash
# 1. On your feature branch
git checkout -b feat/new-feature

# 2. Make your changes, commit them
git add .
git commit -m "feat: add new feature"

# 3. Bump version (creates commit + tag)
npm version minor  # 1.0.0 → 1.1.0

# 4. Push branch and tags
git push origin feat/new-feature
git push origin --tags

# 5. Create PR, merge to main
# (done via GitHub UI)

# 6. Create GitHub Release
# (done via GitHub UI at /releases/new)

# 7. GitHub Actions automatically publishes to npm
# (monitor at /actions)

# 8. Verify
npm view @squeakyrobot/fsrs version
```
