# Security Best Practices

## Git Repository Setup

### Initial Setup Complete ✅

The repository has been initialized with comprehensive security measures:

1. **Git initialized**: Ready for version control
2. **`.gitignore` configured**: Protects sensitive files from being committed
3. **`.env.example` sanitized**: Template without real credentials

## Protected Files

The following files/directories are **automatically ignored** by Git:

### Critical (API Keys & Secrets)
- `.env` - Contains your actual API keys
- `.env.*` - Any environment-specific files
- `**/*credentials*` - Any credential files
- `**/*secrets*` - Any secret files

### Databases & Cache
- `*.db` - SQLite databases
- `cache/` - Cached blockchain data
- `*.sqlite*` - Any SQLite files

### Build Artifacts
- `node_modules/` - Node.js dependencies
- `target/` - Rust compiled binaries
- `dist/`, `build/` - Build outputs

### Logs & Temporary Files
- `*.log` - All log files
- `tmp/`, `temp/` - Temporary directories

## Before First Commit

### 1. Verify .env is Protected

```bash
# This should show NO .env file
git status

# If .env appears, make sure .gitignore is properly configured
cat .gitignore | grep "\.env"
```

### 2. Check for Exposed Secrets

```bash
# Scan for potential API keys in tracked files
git ls-files | xargs grep -i "api.key\|secret\|password" || echo "No secrets found"

# Search for GetBlock.io API keys
git ls-files | xargs grep -E "[a-f0-9]{32,}" || echo "No API keys found"
```

### 3. Remove Sensitive Data (if already committed)

If you've already committed sensitive data:

```bash
# For recent commits (haven't pushed yet)
git reset HEAD~1  # Undo last commit, keep changes
git reset --hard HEAD~1  # Undo and discard changes

# If already pushed to remote (DANGEROUS - rewrites history)
# DON'T DO THIS if others have cloned the repo
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch block_scanner_api/.env" \
  --prune-empty --tag-name-filter cat -- --all

# Then rotate ALL API keys immediately!
```

## Setting Up Your Environment

### 1. Copy the Example File

```bash
cp block_scanner_api/.env.example block_scanner_api/.env
```

### 2. Add Your Credentials

Edit `block_scanner_api/.env`:
```bash
nano block_scanner_api/.env  # or use your preferred editor
```

Replace `YOUR_API_KEY_HERE` with your actual API key.

### 3. Verify Protection

```bash
# .env should NOT appear here
git status

# Should show .env is ignored
git check-ignore block_scanner_api/.env
```

## API Key Security

### GetBlock.io API Keys

1. **Never share** your API keys
2. **Rotate keys** if exposed:
   - Log in to GetBlock.io
   - Generate a new API key
   - Update your `.env` file
   - Delete the old key

3. **Use different keys** for:
   - Development/testing
   - Production
   - Different team members

4. **Monitor usage**:
   - Check GetBlock.io dashboard regularly
   - Set up alerts for unusual activity
   - Monitor rate limit usage

### Self-Hosted Node Credentials

If using a self-hosted Zcash node:

```bash
# Generate a strong password
openssl rand -base64 32

# Add to ~/.zcash/zcash.conf
rpcuser=zcash_api_user
rpcpassword=<generated_password>
```

## GitHub Repository Setup

### First Commit

```bash
# Add all files (sensitive files already ignored)
git add .

# Commit
git commit -m "Initial commit: Zcash Block Scanner with fallback endpoints"

# Set branch name (optional, modern standard)
git branch -M main

# Add remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push
git push -u origin main
```

### Pre-Commit Hook (Optional but Recommended)

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Pre-commit hook to prevent accidentally committing sensitive files

# Check for .env files
if git diff --cached --name-only | grep -E "\.env$"; then
    echo "ERROR: Attempting to commit .env file!"
    echo "This file contains sensitive credentials."
    exit 1
fi

# Check for potential API keys
if git diff --cached | grep -iE "(api.?key|secret|password).*=.*[a-z0-9]{20,}"; then
    echo "WARNING: Potential credentials detected in commit!"
    echo "Please review your changes carefully."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

exit 0
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

## What to Do If You Accidentally Commit Secrets

### Immediate Actions

1. **Rotate all exposed credentials immediately**
   - Generate new API keys
   - Update all instances using the old keys

2. **Remove from Git history**
   ```bash
   # Using git-filter-repo (recommended, install first)
   pip install git-filter-repo
   git filter-repo --path block_scanner_api/.env --invert-paths
   
   # Force push (if already pushed)
   git push origin --force --all
   ```

3. **Notify your team** (if applicable)

4. **Monitor for unauthorized usage**
   - Check GetBlock.io usage logs
   - Monitor for unusual API calls
   - Check if any blockchain transactions occurred

### Prevention

- Use pre-commit hooks (see above)
- Enable branch protection rules on GitHub
- Require pull request reviews
- Use GitHub secret scanning (automatically enabled for public repos)

## Sharing the Project

### Safe Files to Share

✅ Can commit:
- Source code (`.ts`, `.rs`)
- Configuration templates (`.env.example`)
- Documentation (`.md`)
- Build configurations (`package.json`, `Cargo.toml`)
- `.gitignore`

❌ Never commit:
- `.env` files
- Database files (`.db`)
- Cache directories
- API keys or credentials
- Private keys or UFVKs
- Logs with sensitive data

### Code Review Checklist

Before pushing to GitHub:
- [ ] `.env` is listed in `.gitignore`
- [ ] No API keys in source code
- [ ] No hardcoded credentials
- [ ] `.env.example` contains only placeholders
- [ ] README doesn't contain real credentials
- [ ] Documentation uses example/dummy data

## Additional Resources

- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [Git Secret](https://git-secret.io/) - Tool for encrypting secrets in Git
- [SOPS](https://github.com/mozilla/sops) - Encrypted secrets management
- [Pre-commit framework](https://pre-commit.com/) - Git hook framework

## Questions?

If you're unsure whether something is safe to commit:
1. Check if it's in `.gitignore`
2. Ask yourself: "Could someone abuse this if it was public?"
3. When in doubt, don't commit it
