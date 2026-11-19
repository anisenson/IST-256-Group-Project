// script.js - Member storage, display, editing, and JSON download

let members = [];
let editingIndex = -1;

const memberTableBody = document.getElementById("memberTableBody");
const jsonOutput = document.getElementById("jsonOutput");



// Load members from the database through the API.
async function loadMembers() {
    try {
        const response = await fetch("/api/members");
        if (!response.ok) {
            throw new Error("Could not load members.");
        }
        members = await response.json();
        renderTable();
        renderJson();
    } catch (error) {
        console.error(error);
        alert("Could not load members. Is the server running (node server.js)?");
    }
}

// Create a new member (POST) or update the selected one (PUT).
// Returns "" on success, or an error message to show the user.
async function saveMember(member) {
    const editing = editingIndex !== -1;
    const url = editing ? "/api/members/" + encodeURIComponent(members[editingIndex].id) : "/api/members";

    try {
        const response = await fetch(url, {
            method: editing ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(member)
        });
        if (!response.ok) {
            const body = await response.json().catch(function () { return {}; });
            return body.error || "Could not save.";
        }
    } catch (error) {
        return "Could not reach the server.";
    }

    editingIndex = -1;
    await loadMembers(); // reload so the table shows what is really in the database
    return "";
}

// Delete a member (DELETE), then reload the table.
async function deleteMember(index) {
    if (!confirm("Delete " + members[index].fullName + "?")) {
        return;
    }
    const response = await fetch("/api/members/" + encodeURIComponent(members[index].id), { method: "DELETE" });
    if (response.ok) {
        editingIndex = -1;
        await loadMembers();
    }
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

        const deleteButton = document.createElement("button");
        
        deleteButton.type = "button";
        deleteButton.className = "btn btn-outline-danger btn-sm ms-1";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", function () {
            deleteMember(index);
        });
        actionCell.appendChild(deleteButton);

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
