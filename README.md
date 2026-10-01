# Unit 4 — Kubernetes, DevSecOps and Monitoring

Unit 2 built the pipeline. Unit 3 built the box your code travels in. This unit asks the two
questions nobody has asked yet:

> **Is what we are shipping safe?**
> **And how would we know if it stopped working?**

By the end you will have scanned your own container image and found real published
vulnerabilities in it, built a pipeline that **refuses to ship** vulnerable code, and watched
Kubernetes restart a broken app without anybody noticing.

**You do not need to install anything.** Everything runs in your browser.

---

## Start here

**1. Before the session** — read [Unit4-Before-We-Start.md](Unit4-Before-We-Start.md). It takes
ten minutes and ends with a question to bring with you.

**2. On the day** — open [Unit4-Student-Lab-Handout.md](Unit4-Student-Lab-Handout.md) and work
down it. Tick every box, ask for help at every ✅ CHECKPOINT.

**3. If you finish a lab early** — [Unit4-Extra-Practicals.md](Unit4-Extra-Practicals.md) has
twelve short exercises. None is assessed; all of them are worth doing.

**4. To open your workspace** — **Code** → **Codespaces** → **Create codespace on main**.
Docker, `kubectl`, minikube and Trivy are already installed.

> 💡 **Stop your Codespace when you finish.** ☰ menu → *My Codespaces* → **Stop**.

---

## The files

| File | What it is |
|---|---|
| [Unit4-Before-We-Start.md](Unit4-Before-We-Start.md) | **Read first.** The vocabulary, and what to bring |
| [Unit4-Student-Lab-Handout.md](Unit4-Student-Lab-Handout.md) | **The labs.** Labs 0 and A–D, with checkboxes and troubleshooting |
| [Unit4-Notes.md](Unit4-Notes.md) | **The subject notes.** Every concept, with tables, a glossary and exam questions |
| [Unit4-Takeaway-Sheet.md](Unit4-Takeaway-Sheet.md) | **One page for revision.** Print it |
| [Unit4-Extra-Practicals.md](Unit4-Extra-Practicals.md) | **Twelve optional exercises**, none over 7 minutes. Do them if you finish early |
| [Unit4-Homework.md](Unit4-Homework.md) | The assignment, viva questions and mini project |
| [lab-starter/](lab-starter/README.md) | The app, the deliberately insecure Dockerfile, the workflows and the Kubernetes manifests |
| [lab-starter/monitoring/](lab-starter/monitoring/README.md) | Reference only: where a monitoring dashboard's numbers actually come from |

---

## What the labs cover

| Lab | You will | Time |
|---|---|---|
| **0** | Set up: log in, start Kubernetes, check your tools | 15 min |
| **A** | Deploy to Kubernetes; delete a pod and see what happens; scale; load-balance | 25 min |
| **B** | Scan your own image and find real CVEs; fix them; find a hardcoded secret | 30 min |
| **C** | Build a security gate that **fails the build**, then make it pass honestly | 35 min |
| **D** | Add health probes; break the app on purpose; watch Kubernetes repair it | 25 min |

---

## What you need

| Thing | Required? |
|---|---|
| GitHub account | **Yes** |
| Docker Hub account | **Yes** — bring your password, the first command is `docker login` |
| Your Unit 3 image on Docker Hub | Optional — an extra comparison to scan |
| Your Unit 2 pipeline repo | Not needed |

> **If you lost your Unit 2 or Unit 3 work, you are fine.** You build a fresh image in the first
> lab and create a fresh repository in the third. Nothing depends on earlier artifacts surviving.

---

## ⚠️ About the deliberately insecure files

Some files in `lab-starter/` are **intentionally vulnerable**, because you cannot learn to find
problems in code that has none:

| File | What is wrong with it, on purpose |
|---|---|
| `app/Dockerfile` | End-of-life base image, runs as root, copies everything |
| `app/package.json` | Dependencies pinned to old versions with published CVEs |
| `secrets-demo/config.js` | Hardcoded API key, database password and token |

Every one of these is clearly marked in the file itself, and every one has a fix shown next to
it — `app/Dockerfile.hardened`, and the commented block at the bottom of `config.js`.

**All credentials in these files are fake.** Never copy these patterns into real work.

> 🔎 **Expect a security alert on this repository, and do not panic.** The fake keys in
> `secrets-demo/config.js` use the same prefixes as real Stripe and Docker Hub credentials, so
> GitHub flags them.
>
> **That is the tooling working correctly.** It found credentials in source code, which is
> exactly what it is for. Nothing here is a real key and nothing can be used against anybody.
>
> You will meet the same machinery from the other side in **Lab C**, where you create your own
> repository. That lab deletes `secrets-demo/` before pushing — because GitHub's **push
> protection** would otherwise refuse the push outright. A gate that runs before your code is
> even accepted is about as far "left" as shifting left goes.

---

## Where things run

| Environment | Used for | Cost |
|---|---|---|
| **GitHub Codespaces** | Everything — Docker, Kubernetes via minikube, Trivy | Free monthly quota |
| **GitHub Actions** | The CI pipeline and the security gate | Free for public repos |
| **Docker Hub** | Publishing your image | Free |

Your Codespace is configured by `.devcontainer/devcontainer.json`. If a tool is ever missing,
press **Ctrl+Shift+P** → *Codespaces: Rebuild Container*.

---

## When something breaks

The lab handout ends with a troubleshooting table, and the notes have a glossary for any word you
do not recognise. Check those first — most problems here are one of about ten known messages.

If you are stuck for more than a few minutes, ask. Being stuck on an environment problem teaches
you nothing.
