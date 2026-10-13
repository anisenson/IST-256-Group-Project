// script.js - Member storage and display for the Penn State Coding Club signup page
// validation.js calls saveMember(member) after every field passes validation.

const members = [];

const memberTableBody = document.getElementById("memberTableBody");
const jsonOutput = document.getElementById("jsonOutput");

function saveMember(member) {
    members.push(member);
    renderTable();
    renderJson();
}

// textContent (not innerHTML) so user input is shown as plain text, never run as HTML (prevents XSS)
function renderTable() {
    memberTableBody.replaceChildren();

    if (members.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.className = "text-center text-muted";
        cell.textContent = "No members yet.";
        row.appendChild(cell);
        memberTableBody.appendChild(row);
        return;
    }

    members.forEach(function (member) {
        const row = document.createElement("tr");
        const values = [
            member.fullName,
            member.email,
            member.age,
            member.address,
            member.phone === "" ? "-" : member.phone
        ];

        values.forEach(function (value) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        memberTableBody.appendChild(row);
    });
}

function renderJson() {
    jsonOutput.textContent = JSON.stringify(members, null, 2);
}

renderTable();
renderJson();