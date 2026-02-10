# Security Policy

## 🔒 Supported Versions

Currently, only the latest version of the portfolio website is supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| Older   | :x:                |

## 🛡️ Reporting a Vulnerability

If you discover a security vulnerability in this portfolio website, please follow these steps:

### 1. **Do Not** Open a Public Issue
Security vulnerabilities should be reported privately to avoid potential exploitation.

### 2. **Contact Me Directly**
Send an email to: **princymaheshwari069@gmail.com**

Please include:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (optional)

### 3. **Response Time**
- I will acknowledge your report within **48 hours**
- I will provide an estimated timeline for a fix within **7 days**
- You will be notified when the vulnerability is fixed

### 4. **Disclosure Policy**
- Please allow me reasonable time to fix the issue before public disclosure
- I will publicly credit you for the discovery (unless you prefer to remain anonymous)

## 🔐 Security Best Practices

This portfolio follows these security practices:

### Client-Side Security
- No sensitive data stored in local storage
- Form validation to prevent malicious input
- XSS prevention through proper escaping
- HTTPS enforced on deployment

### API Security
- GitHub API calls are read-only
- Contact form uses Formspree with spam protection
- No authentication tokens exposed in client code

### Third-Party Dependencies
- Regular updates of libraries and frameworks
- Only trusted CDNs used for external resources
- Subresource Integrity (SRI) where applicable

## 📝 Known Limitations

### Client-Side Form Processing
- Contact form uses Formspree (third-party service)
- Form data passes through their servers
- Subject to their privacy policy

### Public GitHub Data
- GitHub statistics are publicly available
- No private repository information is accessed

## 🔄 Security Updates

Security updates are released as needed. To stay updated:
- Watch this repository for updates
- Check the [releases page](https://github.com/princymaheshwari/portfolio/releases)
- Follow me on [GitHub](https://github.com/princymaheshwari)

## ✅ Responsible Disclosure

I appreciate responsible disclosure practices. Security researchers who report valid vulnerabilities will be:
- Acknowledged in release notes (with permission)
- Credited in the project README (optional)
- Notified when the issue is resolved

## 📞 Contact

For security concerns:
- **Email**: princymaheshwari069@gmail.com
- **GitHub**: [@princymaheshwari](https://github.com/princymaheshwari)

For general questions, please open a regular issue.

---

Thank you for helping keep this project secure! 🙏
