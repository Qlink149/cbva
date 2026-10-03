# Vultr Firewall Group: direct mode (no Cloudflare)

Edge mode **direct**: browsers connect straight to the VPS; Caddy gets Let's Encrypt certificates by itself.
There are three independent layers; set all three. Each one covers a different gap.

| Layer | Where | What it does | Why it is not enough alone |
|---|---|---|---|
| 1. **Vultr Firewall Group** | Vultr panel, enforced before packets reach the VM | drops everything except the rules below | rules are only as good as the group you attach; easy to forget on a rebuilt instance |
| 2. **ufw** | on the VPS, `bootstrap-vps.sh` | 22 only from `SSH_ALLOW_IP`; 80/443 from anywhere | **ufw does not filter Docker-published ports** (Docker publishes through NAT + the FORWARD chain, which ufw never sees) |
| 3. **DOCKER-USER rules** | on the VPS, `cbva-firewall.service` (`docker-user-firewall.sh`) | from outside, only 80/443 may open new connections to containers; anything else (for example a port published by mistake) is dropped | does not protect the host's own services; ufw does that |

## 1. Rules for the Vultr Firewall Group (inbound)

Create one group per server (`cbva-prod`, `cbva-staging`) and attach it to the instance
(Products → Network → Firewall → Add Firewall Group → Manage → link the instance).

| # | Protocol | Port | Source | IP type | Note |
|---|---|---|---|---|---|
| 1 | TCP | 22 | **your IP /32** (e.g. `203.0.113.7/32`), not "anywhere" | v4 | SSH. Must match `SSH_ALLOW_IP` in `bootstrap-vps.sh`. If your ISP changes your IP, update both |
| 2 | TCP | 80 | anywhere (`0.0.0.0/0`) | v4 | **Required**: Let's Encrypt HTTP-01 validation and the HTTP→HTTPS redirect. Validation comes from several Let's Encrypt vantage points, so you cannot restrict this to a fixed list |
| 3 | TCP | 443 | anywhere (`0.0.0.0/0`) | v4 | HTTPS |
| 4 | TCP | 80 | anywhere (`::/0`) | v6 | only if the instance has IPv6 **and** you publish an AAAA record |
| 5 | TCP | 443 | anywhere (`::/0`) | v6 | same condition |

Notes
- Do not open 8000 (the API), 27017 (MongoDB) or anything else. Anything not listed is dropped once a group is attached.
- ICMP is optional; leave it off unless you want to ping the server.
- UDP 443 (HTTP/3) is not published by `docker-compose.yml`, so it is not needed.
- Staging and production are different servers with different IPs: each gets its own group, both with the same rules.
- Without IPv6 rules and without AAAA records, traffic is IPv4 only, which is fine.

## 2. After the group is attached: check from a machine that is **not** your SSH IP

```bash
nc -vz -w 3 <vps-ip> 22      # must time out (blocked)
nc -vz -w 3 <vps-ip> 8000    # must time out
nc -vz -w 3 <vps-ip> 80      # open
nc -vz -w 3 <vps-ip> 443     # open
curl -sI http://cbva-api.claraai.tech | head -3     # 308 redirect to https once DNS and the certificate exist
```

On the server: `sudo ufw status verbose`, `sudo iptables -S DOCKER-USER`, `sudo iptables -S CBVA-INGRESS`
(direct mode shows accept-80/443 rules, then a drop of every other NEW connection), and
`systemctl status cbva-firewall`.

## 3. Cloudflare mode (kept for later)

If you later put Cloudflare in front, run the bootstrap with `EDGE_MODE=cloudflare` and change the group:
replace rules 2 to 5 with TCP 80 and 443 whose source is Cloudflare's published ranges
(https://www.cloudflare.com/ips-v4 and `/ips-v6`; Vultr's rule form also offers a Cloudflare source preset: **verify in the panel**).
Let's Encrypt validation cannot then reach the server, so that mode uses a Cloudflare Origin CA certificate
(see `Caddyfile.cloudflare` and `README.md`). Check Vultr's current per-group rule limit if you enter the ranges by hand.

## Not verified

I cannot reach the Vultr panel, so the exact field names above, the Cloudflare source preset and the rule limit are
from memory of the Vultr UI. The VPS-side layers (ufw, DOCKER-USER) were tested; see `VERIFICATION_REPORT.md`.
