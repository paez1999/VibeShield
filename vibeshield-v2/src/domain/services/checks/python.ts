import type { Check } from './types'

export const PYTHON_CHECKS: Check[] = [
  {
    id: 'pickle-deserialize',
    category: 'Unsafe Deserialization',
    severity: 'critical',
    title: 'Unsafe Pickle Deserialization',
    description:
      'pickle.loads() executes arbitrary Python code embedded in the serialized data. Deserializing attacker-controlled pickle data leads to remote code execution.',
    fix: 'Never deserialize pickle data from untrusted sources. Use safe formats like JSON or MessagePack. If pickle is required, sign payloads with HMAC and verify before deserializing.',
    pattern: /pickle\.loads\s*\(/gim,
    fileTypes: ['.py'],
  },
  {
    id: 'subprocess-shell',
    category: 'Command Injection',
    severity: 'critical',
    title: 'Command Injection via subprocess with shell=True',
    description:
      'Using shell=True passes the command to the system shell, enabling shell metacharacter injection. If any part of the command string is user-controlled, an attacker can run arbitrary commands.',
    fix: 'Use shell=False (the default) and pass the command as a list: subprocess.run(["ls", directory]). Validate and sanitize all arguments before use.',
    pattern: /subprocess\s*\.\s*(?:run|Popen|call|check_output)\s*\([^)]*shell\s*=\s*True/gim,
    fileTypes: ['.py'],
  },
  {
    id: 'yaml-unsafe-load',
    category: 'injection',
    severity: 'critical',
    title: 'Unsafe YAML Deserialization via yaml.load()',
    description:
      'yaml.load() with the default Loader can deserialize Python objects, allowing arbitrary code execution via crafted YAML payloads. This is equivalent to eval() on the input.',
    fix: 'Replace yaml.load(data) with yaml.safe_load(data), which only deserializes basic YAML types and does not execute Python constructors.',
    pattern: /yaml\.load\s*\(\s*(?![^)]*Loader\s*=\s*yaml\.SafeLoader)/gim,
    fileTypes: ['.py'],
  },
  {
    id: 'flask-debug',
    category: 'configuration',
    severity: 'high',
    title: 'Flask Debug Mode Enabled in Production',
    description:
      'Running Flask with debug=True activates the interactive Werkzeug debugger. If reachable from the internet, it allows unauthenticated remote code execution via the debugger PIN bypass.',
    fix: 'Set debug=False in production. Control debug mode through an environment variable: app.run(debug=os.environ.get("FLASK_DEBUG", "0") == "1").',
    pattern: /app\.run\s*\([^)]*debug\s*=\s*True/gim,
    fileTypes: ['.py'],
  },
  {
    id: 'python-sql-format',
    category: 'injection',
    severity: 'critical',
    title: 'SQL Injection via f-string or .format() Interpolation',
    description:
      'Constructing SQL queries with f-strings or str.format() inserts user-supplied values directly into the query, enabling SQL injection attacks.',
    fix: 'Use parameterized queries with placeholders: cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,)). Never build SQL strings with string formatting.',
    pattern:
      /(?:execute|cursor\.execute)\s*\(\s*(?:f['"]|['"].*\.format\s*\()/gim,
    fileTypes: ['.py'],
  },
]
