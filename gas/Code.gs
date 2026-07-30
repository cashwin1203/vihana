/**
 * U&I Volunteer OS - Single Centre Production Backend
 * Includes Gemini Pro AI Donor Summaries, Heuristic Attrition Flags, & Low Turnout Alerts
 */

const CONFIG = {
  LEADER_PIN: "1234",
  GRACE_MINUTES_BEFORE: 15,
  GRACE_MINUTES_AFTER: 15,
  LOW_TURNOUT_THRESHOLD_PCT: 50, // Flag alert if < 50% checked in after session start
  TIMEZONE: "Asia/Kolkata"
};

// -------------------------------------------------------------
// WEB APP ENTRY POINT
// -------------------------------------------------------------
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('U&I Vihana Volunteer attendance')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// -------------------------------------------------------------
// PUBLIC API: FETCH ACTIVE SESSION & ROSTER
// -------------------------------------------------------------
function getInitialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rosterSheet = ss.getSheetByName('Roster');
  const sessionsSheet = ss.getSheetByName('Sessions');
  const attendanceSheet = ss.getSheetByName('Attendance');

  const now = new Date();
  const todayStr = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd");
  const currentTimeStr = Utilities.formatDate(now, CONFIG.TIMEZONE, "HH:mm");

  const sessionsData = sessionsSheet.getDataRange().getValues();
  let activeSession = null;

  for (let i = 1; i < sessionsData.length; i++) {
    const row = sessionsData[i];
    const sDate = formatDateValue(row[1]);
    
    if (sDate === todayStr) {
      const startTime = row[2];
      const endTime = row[3];
      const grace = row[4] || CONFIG.GRACE_MINUTES_AFTER;

      const windowStart = parseTimeWithGrace(sDate, startTime, -CONFIG.GRACE_MINUTES_BEFORE);
      const windowEnd = parseTimeWithGrace(sDate, endTime, grace);

      activeSession = {
        sessionId: row[0],
        date: sDate,
        startTime: startTime,
        endTime: endTime,
        graceMinutes: grace,
        isOpen: (now >= windowStart && now <= windowEnd),
        isEarly: (now < windowStart),
        isLate: (now > windowEnd),
        windowStartFormatted: Utilities.formatDate(windowStart, CONFIG.TIMEZONE, "hh:mm a"),
        windowEndFormatted: Utilities.formatDate(windowEnd, CONFIG.TIMEZONE, "hh:mm a")
      };
      break;
    }
  }

  const rosterData = rosterSheet.getDataRange().getValues();
  const roster = [];
  for (let i = 1; i < rosterData.length; i++) {
    if (rosterData[i][3] === 'ACTIVE' || rosterData[i][3] === '') {
      roster.push({
        id: rosterData[i][0],
        name: rosterData[i][1],
        role: rosterData[i][2]
      });
    }
  }

  const checkedInIds = [];
  if (activeSession) {
    const attData = attendanceSheet.getDataRange().getValues();
    for (let i = 1; i < attData.length; i++) {
      if (attData[i][1] === activeSession.sessionId) {
        checkedInIds.push(attData[i][2]);
      }
    }
  }

  return {
    todayDate: Utilities.formatDate(now, CONFIG.TIMEZONE, "EEEE, d MMMM yyyy"),
    serverTime: currentTimeStr,
    session: activeSession,
    roster: roster,
    checkedInIds: checkedInIds
  };
}

// -------------------------------------------------------------
// VOLUNTEER CHECK-IN ACTION (SERVER TIME AUTHORITATIVE)
// -------------------------------------------------------------
function checkIn(personId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rosterSheet = ss.getSheetByName('Roster');
  const sessionsSheet = ss.getSheetByName('Sessions');
  const attendanceSheet = ss.getSheetByName('Attendance');

  const now = new Date();
  const todayStr = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd");
  const serverTimestamp = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss");

  const rosterData = rosterSheet.getDataRange().getValues();
  let personName = "";
  for (let i = 1; i < rosterData.length; i++) {
    if (rosterData[i][0] === personId) {
      personName = rosterData[i][1];
      break;
    }
  }
  if (!personName) return { success: false, reason: "Person not found in roster." };

  const sessionsData = sessionsSheet.getDataRange().getValues();
  let session = null;
  for (let i = 1; i < sessionsData.length; i++) {
    const sDate = formatDateValue(sessionsData[i][1]);
    if (sDate === todayStr) {
      session = {
        sessionId: sessionsData[i][0],
        startTime: sessionsData[i][2],
        endTime: sessionsData[i][3],
        grace: sessionsData[i][4] || CONFIG.GRACE_MINUTES_AFTER,
        sDate: sDate
      };
      break;
    }
  }

  if (!session) return { success: false, reason: "No active session scheduled for today." };

  const windowStart = parseTimeWithGrace(session.sDate, session.startTime, -CONFIG.GRACE_MINUTES_BEFORE);
  const windowEnd = parseTimeWithGrace(session.sDate, session.endTime, session.grace);

  if (now < windowStart) {
    return { 
      success: false, 
      reason: `Check-in opens at ${Utilities.formatDate(windowStart, CONFIG.TIMEZONE, "hh:mm a")}. Please wait!` 
    };
  }
  if (now > windowEnd) {
    return { 
      success: false, 
      reason: `Check-in closed at ${Utilities.formatDate(windowEnd, CONFIG.TIMEZONE, "hh:mm a")}. Contact your Centre Leader.` 
    };
  }

  const attData = attendanceSheet.getDataRange().getValues();
  for (let i = 1; i < attData.length; i++) {
    if (attData[i][1] === session.sessionId && attData[i][2] === personId) {
      return { success: true, alreadyCheckedIn: true, personName: personName, time: attData[i][4] };
    }
  }

  const attendanceId = "ATT-" + Math.floor(Math.random() * 899999 + 100000);
  attendanceSheet.appendRow([
    attendanceId,
    session.sessionId,
    personId,
    personName,
    serverTimestamp,
    "PRESENT"
  ]);

  return {
    success: true,
    personName: personName,
    time: Utilities.formatDate(now, CONFIG.TIMEZONE, "hh:mm a")
  };
}

// -------------------------------------------------------------
// REGISTER NEW PERSON
// -------------------------------------------------------------
function registerNewPerson(name, role) {
  if (!name || !name.trim()) return { success: false, reason: "Name cannot be empty." };
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rosterSheet = ss.getSheetByName('Roster');
  
  const prefix = (role === 'STUDENT') ? 'STU-' : 'VOL-';
  const personId = prefix + Math.floor(Math.random() * 899 + 100);
  
  rosterSheet.appendRow([personId, name.trim(), role || 'VOLUNTEER', 'ACTIVE', '']);
  const checkInResult = checkIn(personId);
  checkInResult.personId = personId;
  return checkInResult;
}

// -------------------------------------------------------------
// LEADER DASHBOARD: HEURISTIC ATTRITION & ANOMALY ALERTS
// -------------------------------------------------------------
function getLeaderDashboard(pin) {
  if (pin !== CONFIG.LEADER_PIN) {
    return { success: false, reason: "Invalid Leader PIN." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rosterSheet = ss.getSheetByName('Roster');
  const sessionsSheet = ss.getSheetByName('Sessions');
  const attendanceSheet = ss.getSheetByName('Attendance');

  const rosterData = rosterSheet.getDataRange().getValues();
  const sessionsData = sessionsSheet.getDataRange().getValues();
  const attData = attendanceSheet.getDataRange().getValues();

  const totalSessions = Math.max(1, sessionsData.length - 1);
  const recent4Sessions = sessionsData.slice(-4).map(s => s[0]);
  const recent3Sessions = sessionsData.slice(-3).map(s => s[0]);

  const attMap = {};
  for (let i = 1; i < attData.length; i++) {
    const pid = attData[i][2];
    const sId = attData[i][1];
    if (!attMap[pid]) attMap[pid] = { total: 0, recent3: 0, recent4: 0 };
    attMap[pid].total += 1;
    if (recent3Sessions.includes(sId)) attMap[pid].recent3 += 1;
    if (recent4Sessions.includes(sId)) attMap[pid].recent4 += 1;
  }

  const volunteers = [];
  const students = [];
  const atRiskList = [];

  for (let i = 1; i < rosterData.length; i++) {
    const pid = rosterData[i][0];
    const name = rosterData[i][1];
    const role = rosterData[i][2];
    const status = rosterData[i][3];
    if (status === 'INACTIVE') continue;

    const stats = attMap[pid] || { total: 0, recent3: 0, recent4: 0 };
    const overallRate = Math.round((stats.total / totalSessions) * 100);
    const missedInRecent3 = Math.max(0, recent3Sessions.length - stats.recent3);
    const recent4Rate = Math.round((stats.recent4 / Math.max(1, recent4Sessions.length)) * 100);
    const dropIn4Weeks = Math.max(0, overallRate - recent4Rate);

    let riskLevel = 'GREEN';
    let riskReason = 'Active attendance';

    if (missedInRecent3 >= 2) {
      riskLevel = 'RED';
      riskReason = `Missed ${missedInRecent3} of last 3 sessions (Streak Risk)`;
    } else if (dropIn4Weeks >= 30) {
      riskLevel = 'RED';
      riskReason = `Attendance dropped ${dropIn4Weeks}% over last 4 weeks`;
    } else if (missedInRecent3 === 1 || overallRate < 70) {
      riskLevel = 'AMBER';
      riskReason = `Attendance rate at ${overallRate}%`;
    }

    const item = { pid, name, role, totalAttended: stats.total, overallRate, riskLevel, riskReason };
    if (role === 'VOLUNTEER') volunteers.push(item);
    else students.push(item);

    if (riskLevel === 'RED' || riskLevel === 'AMBER') {
      atRiskList.push(item);
    }
  }

  const now = new Date();
  const todayStr = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd");
  let todayCheckedInCount = 0;
  
  for (let i = 1; i < attData.length; i++) {
    const tStamp = attData[i][4];
    if (tStamp && String(tStamp).substring(0, 10) === todayStr) {
      todayCheckedInCount++;
    }
  }

  const activeVolsCount = Math.max(1, volunteers.length);
  const turnOutPct = Math.round((todayCheckedInCount / activeVolsCount) * 100);
  
  let anomalyAlert = null;
  if (turnOutPct < CONFIG.LOW_TURNOUT_THRESHOLD_PCT) {
    anomalyAlert = {
      isAnomaly: true,
      turnOutPct: turnOutPct,
      checkedIn: todayCheckedInCount,
      totalExpected: activeVolsCount,
      message: `⚠️ Low Turnout Alert: Only ${turnOutPct}% (${todayCheckedInCount}/${activeVolsCount}) checked in today!`
    };
  }

  return {
    success: true,
    stats: {
      totalVolunteers: volunteers.length,
      totalStudents: students.length,
      todayCheckedIn: todayCheckedInCount,
      turnOutPct: turnOutPct,
      totalSessions: totalSessions
    },
    anomalyAlert: anomalyAlert,
    atRiskList: atRiskList,
    volunteers: volunteers
  };
}

// -------------------------------------------------------------
// FEATURE: GEMINI PRO AI DONOR & STAKEHOLDER SUMMARY
// -------------------------------------------------------------
function generateGeminiExecutiveSummary(pin) {
  if (pin !== CONFIG.LEADER_PIN) {
    return { success: false, reason: "Invalid Leader PIN." };
  }

  const apiKey = ScriptProperties.getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return { 
      success: false, 
      reason: "Gemini API key not found. Please set GEMINI_API_KEY in Apps Script Project Settings." 
    };
  }

  const dashData = getLeaderDashboard(pin);
  if (!dashData.success) return dashData;

  const prompt = `You are an executive manager for U&I India non-profit organisation. Write a concise, professional, narrative donor and stakeholder summary report based on the following centre attendance data:

- Total Active Volunteers: ${dashData.stats.totalVolunteers}
- Total Sessions Conducted: ${dashData.stats.totalSessions}
- Today's Checked-In Volunteers: ${dashData.stats.todayCheckedIn} (${dashData.stats.turnOutPct}% turnout)
- Volunteers at Risk of Attrition: ${dashData.atRiskList.length}
- At-Risk Details: ${JSON.stringify(dashData.atRiskList)}

Format the output cleanly in 3 short bulleted sections:
1. 📈 **Monthly Engagement Overview**
2. ⚠️ **Volunteer Retention & Attrition Watchlist**
3. 🎯 **Recommended Leader Action Items**`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());

    if (json.candidates && json.candidates[0] && json.candidates[0].content) {
      const aiText = json.candidates[0].content.parts[0].text;
      return { success: true, aiSummary: aiText };
    } else {
      return { success: false, reason: "Error generating response from Gemini API: " + JSON.stringify(json) };
    }
  } catch (err) {
    return { success: false, reason: "Fetch exception: " + err.toString() };
  }
}

function formatDateValue(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, CONFIG.TIMEZONE, "yyyy-MM-dd");
  }
  return String(val).substring(0, 10);
}

function parseTimeWithGrace(dateStr, timeStr, graceMinutes) {
  const parts = String(timeStr).split(':');
  const hours = parseInt(parts[0] || '0', 10);
  const mins = parseInt(parts[1] || '0', 10);
  const dParts = dateStr.split('-');
  const d = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]), hours, mins, 0);
  d.setMinutes(d.getMinutes() + graceMinutes);
  return d;
}
