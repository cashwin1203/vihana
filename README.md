# U&I Vihana Volunteer attendance

**A Zero-Cost, Serverless Mobile Attendance System & Operational Platform for U&I Vihana Centre**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Google Apps Script](https://img.shields.io/badge/Backend-Google%20Apps%20Script-green?style=flat-square&logo=google)](https://script.google.com/)
[![SQLite](https://img.shields.io/badge/Database-Google%20Sheets%20%2F%20SQLite-003B57?style=flat-square&logo=sqlite)](https://www.sqlite.org/)

---

## Overview

**U&I Vihana Volunteer attendance** is a tamper-proof, serverless operational management platform and mobile check-in app built specifically for U&I Vihana Centre.

It features a zero-login mobile web app powered by Google Apps Script + Google Sheets for single-centre operations, combined with a full-stack Next.js administrative dashboard.

---

## Architecture & System Design

Volunteer OS combines an event-driven API layer with a relational database model and interactive client dashboards.

```
                                  +---------------------------------------+
                                  |        WhatsApp Cloud API /           |
                                  |     In-App WhatsApp Simulator         |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |     Next.js Webhook Controller        |
                                  |    (/api/webhooks/whatsapp/route.ts)  |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |    Conversational Bot State Machine    |
                                  |   (RSVP, Check-In, Session Logging)   |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |        Prisma ORM & SQLite DB         |
                                  |  (Centers, Volunteers, Sessions, etc) |
                                  +---------------------------------------+
                                                      |
               +--------------------------------------+--------------------------------------+
               |                                                                             |
               v                                                                             v
+---------------------------------------------+                               +---------------------------------------------+
|        Coordinator Console Engine           |                               |      Chapter Leader Analytics Dashboard     |
|   (Roster Management & Holiday Pauses)      |                               |      (Retention Watchlist & AI Copilot)     |
+---------------------------------------------+                               +---------------------------------------------+
```

---

## Core System Pillars

### 1. WhatsApp Conversational Automation Engine
- **Automated Friday RSVP Loop:** Proactively dispatches interactive button pings (`[ Attending ]`, `[ Request Absence ]`, `[ Standby Backup ]`) to rostered volunteers.
- **Field Check-In System:** Verifies physical arrival on Saturday afternoons and auto-calculates logged volunteer contribution hours.
- **Conversational Session Logging:** Captures session topics and student observations directly from WhatsApp message payloads.
- **Coordinator Text Commands:** Allows coordinators to query center status by sending `/status` directly to the bot.
- **In-App Web Simulator:** Integrated smartphone mockup for instant browser-based workflow validation.

### 2. Center Coordinator Console
- **Holiday Exception Controls:** One-click toggle (`isPausedForHoliday`) to suspend automated Friday broadcasts during vacation weeks.
- **Roster & Backup Allocation:** Real-time visibility into weekly session staffing ratios with quick backup assignment.
- **Educational Progress Logbook:** Tracks topics taught, group activities, and flags students requiring targeted academic support.

### 3. Chapter Leader Analytics Dashboard
- **Retention Risk Watchlist:** Algorithms automatically flag volunteers missing two or more consecutive sessions to prevent churn.
- **Chapter-Wide Metrics:** Real-time aggregation of active volunteers, total verified hours, student reach, and session completion rates.
- **AI Impact Copilot:** Synthesizes field logs into structured donor grant summaries.

---

## API Reference & Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/dashboard` | `GET` | Aggregates chapter-wide KPIs, active rosters, center capacities, and retention risk list. |
| `/api/centers` | `GET`, `POST`, `PATCH` | Manages center profiles, target volunteer/student ratios, and holiday pause states. |
| `/api/volunteers` | `GET`, `POST`, `PATCH` | Handles volunteer onboarding, skill tagging, status updates, and center assignments. |
| `/api/sessions` | `GET`, `POST`, `PATCH` | Creates upcoming weekend sessions, populates rosters, and updates post-session logs. |
| `/api/attendance` | `PATCH` | Updates volunteer RSVP statuses, check-in timestamps, verified hours, and student records. |
| `/api/webhooks/whatsapp` | `GET`, `POST` | Meta WhatsApp Cloud API verification challenge and conversational message handler. |
| `/api/whatsapp/send` | `POST` | Outbound WhatsApp broadcast dispatcher respecting holiday pause controls. |
| `/api/ai-summary` | `POST` | AI-assisted executive impact report generator for donor communications. |

---

## Data Model (Prisma Schema)

The core relational database model comprises eight primary entities:

- **Organization:** Root NGO entity (e.g., U&I Trust).
- **City:** Geographic cluster (e.g., Bangalore, Chennai).
- **Center:** Individual operational unit with assigned day, slot time, and targets (e.g., Vihana Center).
- **Volunteer:** User profile containing role (`CHAPTER_LEADER`, `COORDINATOR`, `VOLUNTEER`), status (`ACTIVE`, `AT_RISK`), skills, and total verified hours.
- **Student:** Student record assigned to a center with grade level.
- **Session:** Scheduled weekend instance tracking topics, activities, challenges, and completion status.
- **VolunteerAttendance:** Join model tracking individual RSVP status, check-in status, bot state, and logged hours.
- **StudentAttendance:** Tracked student presence and learning needs per session.
