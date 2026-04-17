# Clash Privacy Policy

**Last Updated:** April 1, 2026

## 1. General Provisions

Clash is open-source software that can be used to deploy custom tournament management servers. This privacy policy describes the principles of personal data processing within the Clash ecosystem.

**Important:** Clash is distributed as an open-source project. Each server instance is managed by an independent operator. This policy is **advisory** and must be adapted by each operator to meet their own legal requirements.

## 2. What Data Is Processed

### 2.1. Data Provided by the User

- **Account Credentials:** name, email, password (stored in hashed form)
- **Fighter Profile:** name, alias, category, number of wins
- **Tournament History:** participation, results, rankings

### 2.2. Automatically Collected Data

- **Technical Data:** IP address, client version, device type
- **Session Data:** cookies, authentication tokens
- **Activity Logs:** login time, actions within the system

### 2.3. Blockchain Data (if integrated)

- User's **public wallet address**
- Fighter **rankings** (public data)

## 3. Legal Bases for Processing

Personal data is processed on the following grounds:

- **Performance of a Contract** — providing tournament functionality
- **User Consent** — marketing communications
- **Legitimate Interest** — ensuring security, preventing fraud
- **Legal Obligations** — data retention as required by law

## 4. Purposes of Data Processing

| Purpose                  | Data                  | Retention Period         |
| ------------------------ | --------------------- | ------------------------ |
| Account access provision | Email, password       | Until account deletion   |
| Tournament management    | Fighter data, results | Indefinite (for history) |
| Ranking calculation      | Match history         | Indefinite               |

## 5. Data Sharing with Third Parties

### 5.1. Mandatory Disclosures

- **Blockchain** — public rankings are published on the Polygon network
- **Hosting Providers** — data is stored on the operator’s servers
- **Payment Processors** — when processing transactions

### 5.2. Not Shared

- Personal data is not sold to third parties
- Not shared with advertising networks

## 6. User Rights

Depending on jurisdiction, users have the right to:

- **Access** — obtain a copy of their data
- **Rectification** — correct inaccurate data
- **Erasure** — delete their account and data
- **Restriction** — restrict processing
- **Portability** — receive data in a machine-readable format
- **Objection** — object to processing

**To exercise your rights,** contact the operator of your Clash instance.

## 7. Data Storage and Security

### 7.1. Storage

- Passwords are stored in hashed form (argon2id)
- Personal data is stored in PostgreSQL
- Ranking data may be recorded on the blockchain (irreversibly)

### 7.2. Security Measures

- Regular security updates
- Data backups
- Access control to servers

## 8. Cross-Border Data Transfers

Data may be transferred to countries where the following are located:

- Operator’s servers
- Hosting providers
- The Polygon blockchain network (globally)

The operator must ensure a level of protection no less than required by the laws of the user’s country.

## 9. Cookies and Tracking

Clash uses:

- **Session cookies** — for authentication

No third-party tracking is used.

## 10. For Server Operators

If you deploy your own Clash server:

1. **You are the data controller**
2. **You are required** to notify users of your own policy
3. **It is recommended** to adapt this policy to:
   - Your jurisdiction
   - Your actual server configuration
   - Your data processing practices

4. **Minimum requirements:**
   - Provide contact details for data-related inquiries
   - Specify retention periods
   - Provide a method for account deletion

## 11. Contacts

### For Users

For questions regarding personal data, contact the operator of your Clash instance.

### For Operators and Developers

- GitHub: [https://github.com/Clash-org](https://github.com/Clash-org)
- Email: clash_org@inbox.ru (for project-related inquiries)

## 12. Changes to This Policy

This policy may be updated. Major changes will be announced in the project repository.

---

## Template for Operators (to be placed on your own server)

If you run your own Clash server, please post the following information:

```markdown
# Privacy Policy of [Your Server Name]

**Operator:** [Your Name / Organization Name]
**Contact:** [email for data-related inquiries]
**Last Updated:** [date]

This server uses Clash — an open-source platform for managing tournaments.

### Data Processing Specifics for This Server:

- [List any specifics, if applicable]
- [Log retention periods]
- [How to request data deletion]

### Contacts:

- For data-related inquiries: [email]
- Technical support: [email or link]

### Account Deletion:

To delete your account and all associated data: [instructions]
```
