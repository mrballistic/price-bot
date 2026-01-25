# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| 0.1.x   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email the maintainer directly or use GitHub's private vulnerability reporting feature
3. Include as much detail as possible about the vulnerability
4. Allow reasonable time for the issue to be addressed before public disclosure

## Security Considerations

This project handles sensitive API credentials. When contributing or deploying:

- **Never commit credentials** - Use environment variables or GitHub Secrets
- **Keep `.env` files private** - They are gitignored by default
- **Rotate compromised keys immediately** - If you accidentally expose credentials, regenerate them
- **Use minimal permissions** - Only grant API keys the permissions they need

## Dependencies

We strive to keep dependencies up to date. If you notice an outdated dependency with known vulnerabilities, please open an issue or PR.
