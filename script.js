// script.js - Member storage, display, editing, and JSON download

let members = [];
let editingIndex = -1;

const memberTableBody = document.getElementById("memberTableBody");
const jsonOutput = document.getElementById("jsonOutput");

// Load saved browser data, or load member.json on first use.

async function loadMembers() {
    try {
        const stored = localStorage.getItem("clubMembers");
        if (stored !== null) {
            const saved = JSON.parse(stored);
            if (!Array.isArray(saved)) {
                throw new Error("Saved member data must be an array.");
            }
            members = saved;
        } else {
            const response = await fetch("member.json");
            if (!response.ok) {
                throw new Error("Could not load member.json.");
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error("member.json must contain an array.");

            }
            members = data;
        }
        renderTable();
        renderJson();
    } catch (error) {
        console.error(error);
        alert("Could not load member data. Please use Live Server and check member.json.");

    }
}

// Add a new member or update the selected member.
function saveMember(member) {
    const updatedMembers = members.slice();

    if (editingIndex === -1) {
        updatedMembers.push(member);
    } else {
        updatedMembers[editingIndex] = member;
    }

    // Save before changing the displayed data.
    try {
        localStorage.setItem(
            "clubMembers",
            JSON.stringify(updatedMembers)
        );
    } catch (error) {
        return false;
    }

    members = updatedMembers;
    editingIndex = -1;

    renderTable();
    renderJson();
    return true;
}

// Display user input as plain text.
function renderTable() {
    memberTableBody.replaceChildren();

    if (members.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.className = "text-center text-muted";
        cell.textContent = "No members yet.";

        row.appendChild(cell);
        memberTableBody.appendChild(row);
        return;
    }

    members.forEach(function (member, index) {
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

        const actionCell = document.createElement("td");
        const editButton = document.createElement("button");

        editButton.type = "button";
        editButton.className = "btn btn-outline-primary btn-sm";
        editButton.textContent = "Edit";

        editButton.addEventListener("click", function () {
            editMember(index);
        });

        actionCell.appendChild(editButton);
        row.appendChild(actionCell);
        memberTableBody.appendChild(row);
    });
}

// Load a member into the form for editing.
function editMember(index) {
    const member = members[index];
    editingIndex = index;

    clearErrors();

    document.getElementById("fullName").value = member.fullName;
    document.getElementById("email").value = member.email;
    document.getElementById("age").value = member.age;
    document.getElementById("address").value = member.address;
    document.getElementById("phone").value = member.phone;

    submitButton.textContent = "Save Changes";
    message.className = "alert alert-info mt-3";
    message.textContent = "Editing member. Submit to save your changes.";

    document.getElementById("fullName").focus();
}

// Display the current member array as JSON.
function renderJson() {
    jsonOutput.textContent = JSON.stringify(members, null, 2);
}

// Download an actual JSON file.
document.getElementById("downloadJson").addEventListener("click", function () {
    const json = JSON.stringify(members, null, 2);
    const file = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = url;
    link.download = "members.json";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);
});

loadMembers();