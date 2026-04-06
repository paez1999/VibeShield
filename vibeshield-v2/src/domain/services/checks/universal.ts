import type { Check } from './types'

export const UNIVERSAL_CHECKS: Check[] = [
  {
    id: 'sql-concat',
    category: 'SQL Injection',
    severity: 'critical',
    title: 'SQL Injection via String Concatenation',
    description:
      'Detected SQL query built by concatenating user-supplied input. An attacker can manipulate the query structure to read, modify, or delete arbitrary data.',
    fix: 'Use parameterized queries or prepared statements. Pass user input as bound parameters, never concatenate it directly into the query string.',
    pattern:
      /(?:query|execute|raw)\s*\(\s*[`"'].*?\$\{|(?:query|execute|raw)\s*\(\s*['"].*?\+\s*(?:req\.|params\.|body\.|args)/gim,
  },
  {
    id: 'command-injection',
    category: 'Command Injection',
    severity: 'critical',
    title: 'Command Injection via User Input',
    description:
      'A shell command is constructed from user-controlled data. An attacker can append shell metacharacters to execute arbitrary commands on the host.',
    fix: 'Use execFile() or spawn() with an argument array instead of a shell string. Validate and whitelist input before use.',
    pattern:
      /(?:exec|execSync|spawn|spawnSync)\s*\(\s*(?:[`"'].*?\$\{|['"].*?\+\s*(?:req\.|params\.|body\.))/gim,
  },
  {
    id: 'path-traversal',
    category: 'injection',
    severity: 'critical',
    title: 'Path Traversal via User Input',
    description:
      'A filesystem path is derived from user-supplied input without sanitization. An attacker can supply "../" sequences to read or write files outside the intended directory.',
    fix: 'Resolve the final path with path.resolve() and assert it starts with the expected base directory. Never concatenate user input directly into file paths.',
    pattern:
      /(?:readFile|readFileSync|createReadStream|writeFile|writeFileSync)\s*\([^)]*(?:req\.|params\.|body\.|query\.)/gim,
  },
  {
    id: 'ssrf',
    category: 'injection',
    severity: 'high',
    title: 'Server-Side Request Forgery (SSRF)',
    description:
      'The server fetches a URL controlled by the user. An attacker can point requests at internal services, cloud metadata endpoints, or other private resources.',
    fix: 'Validate and allowlist URLs before fetching. Block private IP ranges and the metadata endpoint (169.254.169.254). Use a URL-parsing library to reject unexpected schemes or hosts.',
    pattern:
      /(?:fetch|axios|got|request|http\.get|https\.get)\s*\(\s*(?:req\.|params\.|body\.|query\.)/gim,
  },
  {
    id: 'hardcoded-password',
    category: 'secrets',
    severity: 'high',
    title: 'Hardcoded Secret or Credential',
    description:
      'A password, API key, token, or other secret is embedded directly in source code. Anyone with access to the repository can extract it.',
    fix: 'Store secrets in environment variables or a secrets manager (e.g., Vault, AWS Secrets Manager). Load them at runtime via process.env and never commit them to source control.',
    pattern:
      /(?:password|passwd|secret|api_key|apikey|token|auth)\s*[:=]\s*['"][^'"]{8,}['"]/gim,
  },
  {
    id: 'md5-hash',
    category: 'cryptography',
    severity: 'critical',
    title: 'Weak Hashing Algorithm: MD5',
    description:
      'MD5 is cryptographically broken and unsuitable for password hashing or integrity checks. Collisions can be computed in seconds on consumer hardware.',
    fix: 'Use bcrypt, scrypt, or Argon2 for password hashing. For integrity checks use SHA-256 or SHA-3.',
    pattern: /(?:createHash|md5|MD5)\s*\(\s*['"]md5['"]/gim,
  },
  {
    id: 'sha1-hash',
    category: 'cryptography',
    severity: 'critical',
    title: 'Weak Hashing Algorithm: SHA-1',
    description:
      'SHA-1 is deprecated for security use. Practical collision attacks exist, and its use in digital signatures or password storage is insecure.',
    fix: 'Replace SHA-1 with SHA-256 or SHA-3. For passwords use bcrypt, scrypt, or Argon2.',
    pattern: /(?:createHash)\s*\(\s*['"]sha1['"]/gim,
  },
  {
    id: 'math-random',
    category: 'cryptography',
    severity: 'high',
    title: 'Insecure Randomness for Security Token',
    description:
      'Math.random() is a pseudo-random number generator not suitable for security-sensitive values. Its output is predictable and can be reverse-engineered.',
    fix: 'Use crypto.randomBytes() or crypto.randomUUID() for tokens, session IDs, nonces, and CSRF values.',
    pattern:
      /Math\.random\s*\(\s*\).*(?:token|secret|key|session|auth|password|nonce|csrf)/gim,
  },
  {
    id: 'eval-usage',
    category: 'injection',
    severity: 'critical',
    title: 'eval() with Dynamic User Input',
    description:
      'eval() executes arbitrary JavaScript. Passing user-controlled data to eval() allows an attacker to run any code on the server or in the browser.',
    fix: 'Remove eval() entirely. Parse data with JSON.parse() for structured data, or use a safe expression evaluator library if dynamic computation is required.',
    pattern:
      /\beval\s*\(\s*(?:req\.|params\.|body\.|query\.|[a-zA-Z_$][\w$]*\s*\+)/gim,
  },
  {
    id: 'unsafe-deserialize',
    category: 'injection',
    severity: 'critical',
    title: 'Unsafe Deserialization',
    description:
      'Deserializing untrusted data can trigger arbitrary code execution via gadget chains embedded in the serialized payload.',
    fix: 'Avoid deserializing data from untrusted sources. If necessary, validate and sign payloads before deserialization, and prefer safe serialization formats like JSON.',
    pattern:
      /(?:unserialize|deserialize|node-serialize|serialize-javascript)\s*\(/gim,
  },
  {
    id: 'cors-wildcard',
    category: 'configuration',
    severity: 'medium',
    title: 'CORS Wildcard Origin',
    description:
      'Allowing all origins (Access-Control-Allow-Origin: *) disables the same-origin policy for this endpoint. Combined with credentials, it can expose user data to any site.',
    fix: "Specify an explicit allowlist of trusted origins. Never combine a wildcard origin with Access-Control-Allow-Credentials: true.",
    pattern:
      /(?:origin\s*:\s*['"][*]['"]|Access-Control-Allow-Origin['"]\s*,\s*['"][*]['"])/gim,
  },
  {
    id: 'jwt-no-verify',
    category: 'authentication',
    severity: 'critical',
    title: 'JWT Decoded Without Signature Verification',
    description:
      "jwt.decode() only base64-decodes the token — it does not verify the signature. An attacker can forge any payload by crafting a token with alg: 'none' or a known key.",
    fix: 'Always use jwt.verify() with the signing secret or public key. Reject tokens where the algorithm is none.',
    pattern: /jwt\.decode\s*\(/gim,
  },
  {
    id: 'idor-by-id',
    category: 'authorization',
    severity: 'high',
    title: 'Insecure Direct Object Reference (IDOR)',
    description:
      'A resource is fetched using an ID taken directly from the request without verifying that the authenticated user owns or has access to that resource.',
    fix: 'Always scope database queries to the authenticated user: findById(id, { where: { ownerId: req.user.id } }). Verify ownership server-side, never trust the client.',
    pattern: /findById\s*\(\s*(?:req\.params|req\.query)/gim,
  },
  {
    id: 'sensitive-logging',
    category: 'information-disclosure',
    severity: 'medium',
    title: 'Sensitive Data Written to Logs',
    description:
      'Passwords, tokens, API keys, cookies, or authorization headers are being logged. Log aggregation systems are often less strictly controlled than production datastores.',
    fix: 'Redact or omit sensitive fields before logging. Use a structured logging library that supports field-level redaction.',
    pattern:
      /(?:console\.log|logger\.\w+)\s*\([^)]*(?:password|token|secret|apiKey|authorization|cookie)/gim,
  },
]
