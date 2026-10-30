# SSL Labs: amcsurin.com B → A+ (คำสั่ง infra)

ตรวจเมื่อ 2026-10-30 · https://www.ssllabs.com/ssltest/analyze.html?d=amcsurin.com

## ผลปัจจุบัน — เกรด **B**

| รายการ | ค่าที่เจอ | ผลต่อเกรด |
|---|---|---|
| Protocol | TLS 1.0, 1.1, 1.2, 1.3 | **TLS 1.0/1.1 = เพดานเกรด B** |
| Cipher | TLS 1.2 ยังมี `TLS_RSA_*` (ไม่มี forward secrecy), `*_CBC_SHA`, `3DES` | ขึ้น "WEAK" หลายตัว + BEAST (เพราะ TLS 1.0 CBC) |
| HSTS | ไม่มี | **ไม่มี HSTS = ไม่ได้ A+** |
| HTTP :80 | ไม่ตอบ (connection fail) | ไม่กระทบเกรด แต่ผู้ใช้พิมพ์ `amcsurin.com` เฉย ๆ บาง browser เข้าไม่ได้ |
| Cert | Google Trust Services (WR3), RSA 2048, หมดอายุ 2026-12-31 (auto-renew) | ผ่าน |
| CAA DNS | ไม่มี | ไม่กระทบเกรด (แนะนำ) |
| Security headers | ไม่มี HSTS / nosniff / X-Frame-Options / Referrer-Policy | — |

Hosting: Global External HTTPS Load Balancer (IP `34.160.201.254`, `via: 1.1 google`) → backend bucket (GCS).
**ทุกข้อต้องแก้ที่ Load Balancer / DNS** — โค้ด frontend เปลี่ยนเกรด SSL Labs ไม่ได้.

## สิ่งที่ต้องทำ (รันใน Cloud Shell ของ project ที่มี LB)

> ต้องมีสิทธิ์ `compute.sslPolicies.*`, `compute.targetHttpsProxies.update`, `compute.backendBuckets.update`.
> ทุกขั้นย้อนกลับได้ (ดูหัวข้อ Rollback). ทำทีละขั้นแล้วเปิดเว็บเช็ค.

### 0. หาชื่อ resource

```bash
gcloud compute forwarding-rules list --global --format="table(name,IPAddress,portRange,target,loadBalancingScheme)"
gcloud compute target-https-proxies list --format="table(name,urlMap,sslPolicy,sslCertificates)"
gcloud compute backend-buckets list --format="table(name,bucketName,enableCdn)"
```
ตั้งตัวแปรตามผลลัพธ์ (แถวที่ IP = `34.160.201.254`):
```bash
HTTPS_PROXY=<ชื่อ target-https-proxy>
BACKEND_BUCKET=<ชื่อ backend-bucket ของเว็บ>
IP_NAME=<ชื่อ address ของ IP 34.160.201.254 — ดูจาก: gcloud compute addresses list --global>
SCHEME=<EXTERNAL หรือ EXTERNAL_MANAGED — ตามคอลัมน์ loadBalancingScheme>
```

### 1. ปิด TLS 1.0/1.1 + cipher อ่อน (B → A)

```bash
gcloud compute ssl-policies create skt-tls12-restricted \
  --profile=RESTRICTED --min-tls-version=1.2 --global

gcloud compute target-https-proxies update "$HTTPS_PROXY" \
  --ssl-policy=skt-tls12-restricted --global
```
- `RESTRICTED` = เหลือ ECDHE + AES-GCM / CHACHA20 เท่านั้น → ตัด `TLS_RSA_*`, CBC, 3DES ทั้งหมด (forward secrecy ครบ, ไม่มี BEAST)
- กระทบเฉพาะเครื่องเก่ามาก (Android < 5, IE11 บน Windows 7/8) — Chrome/Edge/Safari/Firefox ปัจจุบันใช้ได้ปกติ
- มีผลภายใน ~5 นาที

### 2. ใส่ HSTS + security headers (A → A+)

```bash
gcloud compute backend-buckets update "$BACKEND_BUCKET" \
  --custom-response-header="Strict-Transport-Security: max-age=31536000; includeSubDomains" \
  --custom-response-header="X-Content-Type-Options: nosniff" \
  --custom-response-header="X-Frame-Options: DENY" \
  --custom-response-header="Referrer-Policy: strict-origin-when-cross-origin" \
  --custom-response-header="Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()" \
  --custom-response-header="Cross-Origin-Opener-Policy: same-origin"
```
- `update --custom-response-header` **แทนที่ list เดิมทั้งหมด** — ใส่ครบทุกตัวในคำสั่งเดียว
- SSL Labs ให้ A+ เมื่อ HSTS `max-age` ≥ 15552000 (180 วัน); ใช้ 1 ปี
- `includeSubDomains`: ทุก subdomain ต้องเปิด HTTPS ได้ (`www`, `api` เปิดได้แล้ว). ถ้ามี subdomain ที่ยังเป็น HTTP-only ให้ตัด `; includeSubDomains` ออกก่อน
- อยากลองแบบปลอดภัยก่อน: รอบแรกใช้ `max-age=300` เช็คว่าทุกอย่างปกติ แล้วค่อยเปลี่ยนเป็น `31536000`
- **ยังไม่ใส่ `preload`** — ถอนออกจาก preload list ยากมาก (หลายเดือน). พิจารณาทีหลังเมื่อมั่นใจ

### 3. เปิด HTTP :80 → redirect ไป HTTPS

```bash
cat > /tmp/skt-http-redirect.yaml <<'EOF'
name: skt-http-redirect
defaultUrlRedirect:
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  httpsRedirect: true
EOF
gcloud compute url-maps import skt-http-redirect --global --source=/tmp/skt-http-redirect.yaml
gcloud compute target-http-proxies create skt-http-redirect-proxy --url-map=skt-http-redirect --global
gcloud compute forwarding-rules create skt-http-redirect-rule --global \
  --load-balancing-scheme="$SCHEME" --address="$IP_NAME" \
  --target-http-proxy=skt-http-redirect-proxy --ports=80
```
- forwarding rule ใหม่ต้องใช้ IP + scheme เดียวกับของ HTTPS เดิม

### 4. CAA record ที่ DNS (แนะนำ, ไม่กระทบเกรด)

จำกัดว่า CA ไหนออก cert ให้โดเมนนี้ได้ (cert ปัจจุบันมาจาก Google Trust Services):
```
amcsurin.com.  CAA 0 issue "pki.goog"
amcsurin.com.  CAA 0 issue "letsencrypt.org"
```
(เก็บ `letsencrypt.org` ไว้เผื่อ Cloud Run domain mapping ของ `api.amcsurin.com` / บริการอื่นใช้ — ถ้ายืนยันว่าไม่ได้ใช้ ตัดออกได้)

### 5. ตรวจผล

```bash
curl -sI https://amcsurin.com/ | grep -iE "strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy"
curl -sI http://amcsurin.com/ | head -3          # ต้องได้ 301 → https
```
แล้วกด **Clear cache** ใน SSL Labs (หรือเปิด `https://www.ssllabs.com/ssltest/analyze.html?d=amcsurin.com&clearCache=on`) — ต้องได้ **A+**
เช็ค `www.amcsurin.com` ด้วย (ใช้ LB เดียวกัน).

## Rollback

```bash
gcloud compute target-https-proxies update "$HTTPS_PROXY" --clear-ssl-policy --global
gcloud compute backend-buckets update "$BACKEND_BUCKET" --no-custom-response-headers
gcloud compute forwarding-rules delete skt-http-redirect-rule --global
```
หมายเหตุ: browser ที่เคยรับ HSTS แล้วจะบังคับ HTTPS ต่อจนครบ `max-age` แม้ลบ header — เหตุผลที่ควรเริ่มที่ 300 วินาที.

## นอกขอบเขต frontend (แจ้ง backend)

- `api.amcsurin.com` เป็น Cloud Run domain mapping (`server: Google Frontend`) — ตั้ง SSL policy เองไม่ได้.
  ถ้าต้องการ A+ ฝั่ง API ด้วย: ย้ายไปอยู่หลัง External HTTPS LB + serverless NEG แล้วใช้ ssl-policy เดียวกัน + HSTS ผ่าน custom response header ของ backend service.
- CSP ตอนนี้อยู่ใน `<meta>` (`index.html`) — `frame-ancestors` ใน meta ไม่มีผล; ใช้ `X-Frame-Options: DENY` จากขั้น 2 แทน.
  ถ้าจะย้าย CSP เป็น header จริงในอนาคต ใส่เพิ่มใน `--custom-response-header` ได้ (ต้องตัด `localhost` ออกจาก `connect-src` ของ prod).
