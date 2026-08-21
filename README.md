# Self-Auditable Password Vault

A small, personal password-vault system built around **Google Sheets, an independently verified hash checker, and a self-contained HTML decryption client**.

The design deliberately separates:

- **encrypted data storage** — Google Sheets
- **verification of the verification software** — `hosted_hash_checker.html`
- **verification of the local hash checker that opens the actual html for encryption and decryption** — `local_hash_checker.html`
- **actual decryption** — `encrypt_decrypt.html`

The goal is not to eliminate trust. Instead, the goal is to **reduce the trusted computing base and make each important component independently verifiable**.

The system assumes that the local operating system and browser are trusted while the vault is being used, but does **not** blindly trust the web server, Google Sheets, or the copies of the HTML files served over the network.

---

# How It Works

The verification process deliberately uses two separate stages.

```text
      GOOGLE SHEETS
            │
            │ Apps Script
            ▼
Verify hosted_hash_checker.html
            │
            ▼
Does the hosted file match
  its known-good hash?
            │
    ┌───────┴───────┐
    │               │
   NO              YES
    │               │
  STOP              ▼
            Open hosted checker
             from the website
                    │
                    ▼
        Select local_hash_checker.html
                    │
                    ▼
          Hosted checker hashes
         the selected local file
                    │
                    ▼
          Do you recognize the
          expected fingerprint?
                    │
             ┌──────┴──────┐
             │             │
            NO            YES
             │             │
           STOP            ▼
                 STOP USING HOSTED CHECKER
                           │
                           ▼
                Open local_hash_checker.html
                    from file explorer
                           │
                           ▼
                 Select encrypt_decrypt.html
                           │
                           ▼
                  Local checker hashes
                  encrypt_decrypt.html
                           │
                           ▼
                 Does the hash match with
                    the expected hash?
                           │
                    ┌──────┴──────┐
                    │             │
                   NO            YES (only then the "Open file" button becomes clickable)
                    │             │
                  STOP            ▼
                            Open verified
                           content of file
                                  │
                                  ▼
						Enter master password
                                  +
                           encrypted value
                                  │
                                  ▼
								PBKDF2
                                  │
                                  ▼
                              AES-GCM
                                  │
                                  ▼
                           decrypted value
                                  │
                                  ▼
					  Drag-and-drop to target app
                          or copy to clipboard
```

The crucial security properties are:

> **A checker verifies a file before that file is trusted.**

and:

> **The hosted checker never gets to choose what is ultimately executed.**

The local checker is different: once the local checker itself has been independently verified, it may open the verified content of `encrypt_decrypt.html`.

---

# 1. Google Sheets

Google Sheets stores the encrypted password values.

The spreadsheet also contains the Apps Script used to verify the hosted hash checker.

The Apps Script retrieves the bytes of the expected `hosted_hash_checker.html` resource and calculates its SHA-256 hash. That hash is compared against a **known-good value established independently of the current server response**.

Verification can be performed when the spreadsheet is opened and/or when relevant spreadsheet activity occurs.

The Sheet therefore acts as the starting point of the workflow rather than directly decrypting secrets.

The encrypted values can be copied from the Sheet and subsequently pasted into the independently verified local decryption application.

Google Sheets is intentionally treated as **untrusted storage**.

---

# 2. Verification of `hosted_hash_checker.html`

`hosted_hash_checker.html` is the first checker used by the workflow.

It may be hosted on a personal server or another web host.

The Apps Script associated with the spreadsheet retrieves the hosted file and calculates its SHA-256 hash.

Conceptually:

```text
Hosted server
     │
     ▼
hosted_hash_checker.html
     │
     ▼
SHA-256
     │
     ▼
Known-good hash
     │
 ┌───┴───┐
 │       │
MATCH   MISMATCH
 │       │
 ▼       ▼
PASS    STOP
```

If the hash does not match, the workflow stops.

If it matches, the user may open the hosted checker in a browser.

## Why is another verification step necessary?

A server can potentially distinguish between different requests.

For example, it could return the expected bytes to the Apps Script while returning different bytes to the browser.

Therefore, **the Apps Script verification alone is not considered sufficient**.

The user independently verifies the hosted checker by using it to hash the known-good local checker.

The user compares the resulting human-readable fingerprint with the independently retained expected fingerprint.

If the fingerprint is not recognized, the workflow stops.

---

# 3. The Hosted Checker Only Verifies

This is an important security property.

`hosted_hash_checker.html` should **not** have an "Open File" button.

It should not:

- create a Blob URL for the selected file;
- navigate to the selected file;
- execute the selected file;
- put the selected file into an iframe;
- automatically launch the selected file;
- modify the selected file.

Its job is only:

```text
Select local file
      │
      ▼
  Read bytes
      │
      ▼
   SHA-256
      │
      ▼
Display fingerprint
      │
      ▼
    STOP
```

This prevents a compromised hosted checker from performing the following attack:

```text
1. Read legitimate local file
2. Calculate hash of legitimate file
3. Create a malicious Blob
4. Open the malicious Blob instead of the checked file
```

The hosted checker is deliberately **not given the authority to perform step 4**.

After the fingerprint has been verified, the user stops using the hosted checker and independently opens the local `local_hash_checker.html` through the operating system's file manager.

The hosted checker therefore has no role in executing the application that will eventually receive the master password.

---

# 4. Verification of `local_hash_checker.html`

The local hash checker is opened directly from local storage after its known-good fingerprint has been verified by the hosted checker.

Unlike the hosted checker, the local checker may provide an **"Open file"** function.

The local checker is trusted for this purpose because:

1. its exact bytes were verified before execution;
2. it is running locally;
3. it contains the expected hash of `encrypt_decrypt.html`;
4. it independently hashes the selected `encrypt_decrypt.html` file and compares its actual hash against that expected value;
5. only after the hash matches does the user confirm the displayed fingerprint.

After the expected hash has been successfully verified and the user confirms the fingerprint, those exact verified bytes can be used to construct the content of `encrypt_decrypt.html`.

This ensures that the file which is opened is the same file whose integrity was checked, rather than fetching or reading the file again after verification.

```text
Local encrypt_decrypt.html
          │
          ▼
    Read file once
          │
          ├──────────────────────┐
          │                      │
          ▼                      ▼
       SHA-256              Same bytes
          │                      │
          ▼                      │
 Hash verification               │
          │                      │
          ▼                      │
       MATCH ────────────────────┘
                                 │
                                 ▼
                         document.open()
                         document.write(decodedBytes)
                         document.close()
```

The important property is that the HTML is created from the **same bytes that were hashed before**.

The local checker must not hash one copy and subsequently fetch or open a different copy from a server.

This provides a convenient way to execute the verified local HTML application while avoiding the need to rely on the browser's direct handling of the original local file URL.

---

# 5. Human-Readable Hash Fingerprints

The underlying verification uses the complete SHA-256 value.

For practical human verification, the complete hash can additionally be represented as a shorter fingerprint.

One possible representation is a deterministic sequence of words derived from part of the SHA-256 value.

For example:

```text
copper, violin, desert, rocket, amber, turtle
```

The human-readable representation is **not the cryptographic verification itself**. The complete SHA-256 is still calculated internally and shown above the sequence of words.

The short representation exists only to make human verification practical.

The security of this step therefore depends on both:

- the number of bits represented by the fingerprint;
- the user's ability to reliably recognize a mismatch.

The known-good fingerprint should be retained independently of the file being verified.

A short fingerprint should not be confused with the full cryptographic hash. It is a **human-verification aid**, not a replacement for SHA-256.

---

# 6. Decryption & Memory Security

Once the local `encrypt_decrypt.html` has been independently verified, the local checker can open the exact verified bytes.

The application is self-contained and does not need a password-manager server.

The user enters:

- the master password;
- the encrypted value copied from Google Sheets.

The application derives an encryption key using PBKDF2 and decrypts the value using AES-GCM.

Conceptually:

```text
Master password
      │
      ▼
    PBKDF2
      │
      ▼
Derived encryption key
      │
      +
Encrypted value
      │
      ▼
   AES-GCM
      │
      ▼
 Plaintext password
      │
      ▼
  Clipboard
```

The decryption application does not send the master password or plaintext password to a server as part of its intended operation.

---

### Memory Clearing and the "Lock Vault" Mechanism
JavaScript strings are immutable, making traditional in-memory scrubbing of passwords unreliable. This project mitigates this by isolating the entire decryption UI and logic inside a strictly sandboxed iframe (`sandbox="allow-scripts"`). 

When the user clicks **"Lock Vault"**, the parent document completely destroys the iframe DOM element (`innerHTML = ''`). This forces the browser to tear down the entire execution context, obliterating the isolated JavaScript heap, DOM nodes, call stack, and any lingering variables or strings. This provides robust, browser-native memory clearing that bypasses JS engine optimization quirks.

### ⚠️ Clipboard Warning & Drag-and-Drop Recommendation
The OS clipboard is a global, shared resource. Any background application, screen-recording tool, or overly privileged browser extension can read its contents the exact millisecond data is copied. 

While the "Lock Vault" function attempts to overwrite the clipboard with "CLEARED" as a hygiene measure, **this does not undo the initial exposure**. 

**Recommended Action**: Instead of using the "Copy" button, **highlight and Drag-and-Drop** the decrypted password directly from the input field into your target application's password field. This bypasses the OS clipboard API entirely, moving the data directly from the browser's rendering engine to the target application.

---

# Trust Model

The design deliberately distributes trust.

## Google Sheets
Google Sheets provides **storage and availability**.
It is not trusted with respect to plaintext confidentiality.
An attacker who gains access to the spreadsheet may be able to read or modify encrypted values.
The encrypted values should therefore remain unusable without the master password and the correct decryption implementation.

## Web Server
The web server hosts `hosted_hash_checker.html`.
It is **not blindly trusted**.
The hosted file is first checked against a known-good hash by Apps Script.
The user then independently verifies the hosted checker against the known-good local checker.
A compromised web server should therefore not be able to silently substitute a different checker without encountering one of these verification steps.

## `hosted_hash_checker.html`
The hosted checker is trusted only for one narrow purpose:
> **Calculate the hash of a user-selected local file and display the result.**

It should not have the ability to execute the file it verifies.
This significantly limits the consequences of a malicious hosted checker.

## `local_hash_checker.html`
The local checker verifies the actual decryption application before it is executed.
It is itself verified by the hosted checker first.
The local checker may open the decryption application, but only from the **same bytes it has just hashed**.

## `encrypt_decrypt.html`
This is the most security-sensitive component because it receives the master password.
It is not trusted merely because it is stored locally.
Its exact bytes are verified before execution, and its runtime environment is strictly sandboxed and destroyable.

## Browser and Operating System
The browser and local operating system are ultimately part of the trusted computing base.
If they are compromised, the security guarantees of the system no longer hold.
This architecture does not attempt to protect against a compromised endpoint.

---

# What a Single Compromised Component Should Mean

The design attempts to make compromise of an individual component either **detectable or insufficient by itself**.

### Google Sheets compromised
An attacker may obtain or modify encrypted values.
They should not automatically obtain the master password or plaintext passwords.

### Web server compromised
An attacker may replace `hosted_hash_checker.html`.
The Apps Script verification should detect a changed hosted file.
Additionally, the user independently verifies the checker before trusting it.
The workflow stops if the expected fingerprints are not recognized.

### Hosted checker compromised
A malicious hosted checker could lie about a hash or attempt to present manipulated data.
It should nevertheless be unable to replace the file that is ultimately executed because:
> **The hosted checker never opens the verified file.**

### Local checker compromised
The hosted checker verifies the local checker before it is trusted.
A modified local checker should therefore produce a different fingerprint.

### `encrypt_decrypt.html` compromised
The local checker hashes the actual local file.
If the fingerprint does not match the known-good value, the application is not opened.
If it does match, the local checker opens the **same bytes that were hashed**, rather than fetching another copy.

### Master password compromised
This is outside the protection provided by the architecture.
If the master password is compromised, the encrypted vault should be considered compromised and the affected credentials should be changed.

---

# Why Verify the Checker Instead of Sending the Decryption Application to the Server?

The `encrypt_decrypt.html` contains the most sensitive application logic.
It may contain cryptographic parameters, implementation details, or other functionality that should not be disclosed to an external server.

A hosted hash checker that directly hashes `encrypt_decrypt.html` therefore gets access to the entire source code.

Instead, the remote checker only needs to inspect the relatively small and intentionally simple `local_hash_checker.html`.

The local checker can then inspect `encrypt_decrypt.html`.

This creates a useful confidentiality boundary:
```text
REMOTE
  │
  │ sees
  ▼
local_hash_checker.html
  │
  │ locally sees
  ▼
encrypt_decrypt.html
```

The remote server does not need access to the actual password-management implementation. This reduces the amount of sensitive source code exposed to the remote verification service.

---

# Cryptography

The project uses standard browser cryptography rather than implementing cryptographic primitives itself.

## PBKDF2
PBKDF2 derives an encryption key from the master password.
A cryptographically random salt is used.
The iteration count (default 600,000) is embedded in the ciphertext to allow future decryption even if the default is adjusted. PBKDF2 is a password-based key derivation function, not an encryption algorithm.

## AES-GCM
AES-GCM provides authenticated encryption.
It provides both:
- confidentiality;
- authentication/integrity of the ciphertext.

If ciphertext is modified, AES-GCM verification will fail rather than silently producing modified plaintext.

### IV/nonce requirements
AES-GCM nonce handling is critical.
A nonce/IV must **never be reused with the same encryption key**.
The application generates and stores a fresh, cryptographically random 96-bit nonce for each encryption operation.

---

# No External Dependencies

The final decryption application is intended to be self-contained.
It does not depend on:

- npm packages;
- CDNs;
- external JavaScript libraries;
- external APIs;
- remote fonts;
- third-party services.

Cryptographic operations are provided by the browser's native Web Crypto API.
The `encrypt_decrypt.html` can therefore be backed up as a single file.
This also makes its exact bytes easy to verify.

---

# Backups

Important backup components include:

- encrypted Google Sheets data;
- known-good `hosted_hash_checker.html`;
- known-good `local_hash_checker.html`;
- known-good `encrypt_decrypt.html`;
- known-good SHA-256 values;
- human-readable fingerprints;
- required salts/metadata/recovery information.

Backups should themselves be protected appropriately.
The goal is to avoid making any single online service the only possible source of recovery.

---

# Security Philosophy

The project follows a simple principle:

> **Do not blindly trust software that handles your secrets. Verify it first.**

The hash checker does not make the underlying cryptography stronger.
Its purpose is to create an explicit, inspectable boundary between:

- an untrusted hosting environment;
- the local verification process;
- and the application that ultimately receives the master password.

The decryption application is deliberately small and self-contained so that its complete source can be inspected and its exact bytes can be independently verified.

The system does not attempt to create a magical "trustless" password manager.
Instead, it attempts to make trust **small, explicit, and auditable**.

---

# Limitations

This project does not protect against:

- a compromised operating system;
- malware, keyloggers, or screen capture running *while the vault is unlocked*;
- a compromised browser or browser extension with elevated privileges;
- clipboard theft (if the "Copy" button is used instead of Drag-and-Drop);
- a compromised Web Crypto implementation;
- a stolen master password;
- someone controlling the computer while the vault is unlocked;
- an attacker who compromises the trusted verification process;
- an attacker who can modify the local files _and_ bypass the local operating system's security;
- loss of all backups;
- human error when recognizing or recording fingerprints.

There is also an important limitation inherent in human verification:

> **The security of the human-verification step depends on the user actually recognizing the expected fingerprint.**

A short fingerprint is therefore a usability/security compromise rather than a replacement for the full SHA-256.
The complete SHA-256 remains the underlying cryptographic value.

---

# Security Assumptions

The architecture is based on several explicit assumptions:

1. **The local operating system is trusted.**
2. **The browser is trusted.**
3. **The user has an independently retained known-good fingerprint for the relevant files.**
4. **The user actually performs the fingerprint comparison.**
5. **The user does not open a file through the hosted checker after verifying it.**
6. **The final HTML application is opened from the exact bytes that were verified.**
7. **The master password remains secret.**
8. **The cryptographic implementation correctly handles PBKDF2, AES-GCM, salts, and nonces.**
9. **The user utilizes Drag-and-Drop rather than the OS clipboard to transfer decrypted secrets.**

If any of these assumptions fail, the security guarantees change accordingly.

---

# Project Status

This is a personal security project and an experiment in building a password-management system that can be independently maintained and audited.

It should be considered **experimental software**, not a replacement for professionally audited password-management software.

The project is published primarily so that others can:

- inspect the implementation;
- reproduce it;
- identify weaknesses;
- challenge the threat model;
- suggest improvements;
- and potentially build their own version.

**Security criticism is welcome.**

The goal is not to claim that the system is perfectly secure. The goal is to make the security assumptions, trust boundaries, and failure modes explicit enough that they can be examined.
