# EasyPanel Git Pull Troubleshooting Guide

## Issue: "Failed to pull changes" in EasyPanel

This guide helps diagnose and fix Git pull failures in EasyPanel deployments.

## Quick Checks

### 1. Verify Repository Configuration in EasyPanel

1. Go to your project settings in EasyPanel
2. Check the **Source** or **Repository** section
3. Verify:
   - **Repository URL**: `https://github.com/ViableSystemsGlobal/hosthub.git`
   - **Branch**: `main`
   - **Build Path**: (usually `/` or empty)

### 2. Repository Access

#### If Repository is **Public**:
- No authentication needed
- EasyPanel should be able to pull directly
- Check if GitHub is accessible from your server

#### If Repository is **Private**:
You need to configure authentication. Choose one:

**Option A: SSH Deploy Key (Recommended)**
1. Generate an SSH key pair on your server:
   ```bash
   ssh-keygen -t ed25519 -C "easypanel-deploy" -f ~/.ssh/easypanel_deploy
   ```
2. Copy the **public key** (`~/.ssh/easypanel_deploy.pub`)
3. Go to GitHub → Repository → Settings → Deploy keys
4. Click "Add deploy key"
5. Paste the public key and give it a title (e.g., "EasyPanel Deploy")
6. In EasyPanel, configure SSH authentication with the **private key**

**Option B: GitHub Personal Access Token**
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate a new token with `repo` scope
3. In EasyPanel, use HTTPS URL with token:
   ```
   https://YOUR_TOKEN@github.com/ViableSystemsGlobal/hosthub.git
   ```

### 3. Network Connectivity

Test if your server can reach GitHub:

```bash
# Test DNS resolution
nslookup github.com

# Test HTTPS connectivity
curl -I https://github.com

# Test Git connectivity
git ls-remote https://github.com/ViableSystemsGlobal/hosthub.git
```

### 4. Check EasyPanel Logs

1. In EasyPanel, go to your project
2. Check the **Logs** or **Build Logs** section
3. Look for detailed error messages about:
   - Authentication failures
   - Network timeouts
   - Permission denied errors
   - Repository not found errors

## Common Error Messages and Solutions

### "Permission denied (publickey)"
**Solution**: Configure SSH authentication (see Option A above)

### "Repository not found" or "404"
**Solution**: 
- Verify repository URL is correct
- Check if repository exists and is accessible
- For private repos, ensure authentication is configured

### "Connection timeout" or "Network unreachable"
**Solution**:
- Check server's internet connectivity
- Verify firewall rules allow outbound HTTPS (port 443)
- Check if GitHub is blocked by network policies
- Try using a different DNS server (8.8.8.8, 1.1.1.1)

### "Failed to pull changes" (generic)
**Solution**:
1. Check EasyPanel's Git configuration
2. Try manually pulling in EasyPanel's terminal:
   ```bash
   cd /path/to/project
   git pull origin main
   ```
3. Verify Git is installed on the server
4. Check disk space: `df -h`

## Manual Deployment Alternative

If Git pull continues to fail, you can deploy manually:

1. **Clone repository locally** (if not already):
   ```bash
   git clone https://github.com/ViableSystemsGlobal/hosthub.git
   cd hosthub
   ```

2. **Create a deployment package**:
   ```bash
   # Create a tarball excluding node_modules and .git
   tar --exclude='node_modules' \
       --exclude='.git' \
       --exclude='.next' \
       -czf hosthub-deploy.tar.gz .
   ```

3. **Upload via EasyPanel**:
   - Use EasyPanel's file upload feature
   - Or use SCP/SFTP to upload to server
   - Extract in the project directory

4. **Run build commands**:
   ```bash
   npm ci --legacy-peer-deps
   npx prisma generate
   npm run build
   ```

## Verification Steps

After fixing the issue, verify:

1. **Test Git Pull**:
   ```bash
   git pull origin main
   ```

2. **Check Latest Commit**:
   ```bash
   git log -1
   ```
   Should show: `59cccc3 Add .nixpacks/Dockerfile with Docker Hub base image...`

3. **Trigger Deployment**:
   - In EasyPanel, click "Deploy" or "Redeploy"
   - Monitor the build logs

## Current Repository Status

- **Repository**: `https://github.com/ViableSystemsGlobal/hosthub.git`
- **Branch**: `main`
- **Latest Commit**: `59cccc3` - "Add .nixpacks/Dockerfile with Docker Hub base image to avoid ghcr.io network issues"
- **Status**: All commits pushed successfully

## Next Steps

1. Check EasyPanel project settings for repository configuration
2. Verify authentication if repository is private
3. Check EasyPanel build logs for detailed error messages
4. Test network connectivity from server to GitHub
5. If all else fails, use manual deployment method

## Support

If the issue persists:
1. Check EasyPanel documentation: https://easypanel.io/docs
2. Review EasyPanel community forums
3. Check server system logs: `journalctl -u easypanel` (if applicable)
4. Contact EasyPanel support with:
   - Error message from logs
   - Repository URL and branch
   - Authentication method used
   - Network connectivity test results

