---
allowed-tools: Bash(vault kv get:*), Bash(curl:*), Question
description: Manage Cloudflare DNS records. Usage: /cloudflare-dns [action] [args]. Actions: add, delete, update, list
---

## Auth

- Execute vault CLI to Getting `zone_id` And `token`

```sh
vault kv get -format=json -mount=kv cloudflare  2>/dev/null || echo '{"error": "Vault not authenticated or secret not found"}
```

## Actions

### LIST (default)

List all DNS records in the zone. Display in table: | Name | Type | Content | Proxied | ID |

### ADD

Create a new DNS record. Parameters:

- **type**: A, AAAA, CNAME, MX, TXT, NS, SRV (default: A)
- **name**: Record name - REQUIRED
- **content**: Record value - REQUIRED
- **proxy**: Enable Cloudflare proxy (default: false, only for A/AAAA/CNAME)

For MX: ask priority (default: 10)
For SRV: ask priority (default: 10), weight (default: 5), port (REQUIRED)

Use Question tool for missing required fields.

### DELETE

Remove a DNS record. Parameters:

- **record_id**: DNS record ID - REQUIRED
- OR **name**: Search and delete by name

### UPDATE

Modify an existing DNS record. Parameters:

- **record_id**: DNS record ID - REQUIRED
- **type**: DNS record type
- **name**: Record name
- **content**: Record value
- **proxy**: Enable proxy (true/false)

Use Question tool for missing required fields.

## Usage Patterns

- `/cloudflare-dns` → list all records
- `/cloudflare-dns add A www 192.168.1.1` → add A record
- `/cloudflare-dns delete abc123` → delete by ID
- `/cloudflare-dns delete www` → delete by name
- `/cloudflare-dns update abc123 A www 192.168.1.2` → update record

## Error Handling

Display clear error messages. Common errors:

- 403: Invalid token or insufficient permissions
- 404: Record not found
- 409: Record already exists
- 422: Invalid record data
