// resources.js - Resource form validation, table, jQuery search, and JSON

const STORAGE_KEY = "clubResources";

let resources = [];
let editingIndex = -1;

const fields = ["resourceId", "resourceTitle", "category", "format", "resourceLink", "price"];

// Mark an invalid field and show its error.
function showError($input, text) {
    $input.removeClass("is-valid").addClass("is-invalid");
    $("#" + $input.attr("id") + "Error").text(text);
}

// Mark a valid field.
function showValid($input) {
    $input.removeClass("is-invalid").addClass("is-valid");
    $("#" + $input.attr("id") + "Error").text("");
}

// Remove validation styling and error text.
function clearField($input) {
    $input.removeClass("is-invalid is-valid");
    $("#" + $input.attr("id") + "Error").text("");
}

// Show a Bootstrap alert under the form (success, danger, info, warning).
function showMessage(type, text) {
    $("#resourceMessage").attr("class", "alert alert-" + type + " mt-3").text(text);
}

function clearMessage() {
    $("#resourceMessage").attr("class", "mt-3").text("");
}

// Only allow http and https links.
function isSafeUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (error) {
        return false;
    }
}

// Give every resource the same fields and types.
function normalizeResource(item) {
    const price = Number(item.price);

    return {
        id: String(item.id || "").trim().toUpperCase(),
        title: String(item.title || "").trim(),
        category: String(item.category || "").trim(),
        format: String(item.format || "").trim(),
        link: isSafeUrl(item.link) ? String(item.link).trim() : "",
        price: Number.isFinite(price) && price >= 0 ? price : 0,
        notes: String(item.notes || "").trim()
    };
}

// ID must look like R001 and not belong to another resource.
function validateId() {
    const $input = $("#resourceId");
    const id = $input.val().trim().toUpperCase();

    if (id === "") {
        showError($input, "Please enter a resource ID.");
        return false;
    }

    if (!/^R\d{3,}$/.test(id)) {
        showError($input, "ID must be the letter R followed by at least 3 digits, like R001.");
        return false;
    }

    const duplicate = resources.some(function (item, index) {
        return index !== editingIndex && item.id === id;
    });

    if (duplicate) {
        showError($input, "That ID is already used by another resource.");
        return false;
    }

    showValid($input);
    return true;
}

function validateTitle() {
    const $input = $("#resourceTitle");
    const title = $input.val().trim();

    if (title === "") {
        showError($input, "Please enter a title.");
        return false;
    }

    if (title.length < 3 || title.length > 100) {
        showError($input, "Title must be between 3 and 100 characters.");
        return false;
    }

    showValid($input);
    return true;
}

function validateCategory() {
    const $input = $("#category");

    if ($input.val() === "") {
        showError($input, "Please choose a category.");
        return false;
    }

    showValid($input);
    return true;
}

function validateFormat() {
    const $input = $("#format");

    if ($input.val() === "") {
        showError($input, "Please choose a format.");
        return false;
    }

    showValid($input);
    return true;
}

// Link is optional, but must be a full URL if entered.
function validateLink() {
    const $input = $("#resourceLink");
    const link = $input.val().trim();

    if (link === "") {
        clearField($input);
        return true;
    }

    if (!isSafeUrl(link)) {
        showError($input, "Enter a full link starting with http:// or https://.");
        return false;
    }

    showValid($input);
    return true;
}

// Price must be 0 or more with at most 2 decimal places.
function validatePrice() {
    const $input = $("#price");
    const value = $input.val().trim();

    if (value === "") {
        showError($input, "Please enter a price. Use 0 for free.");
        return false;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
        showError($input, "Price must be 0 or more with up to 2 decimal places.");
        return false;
    }

    showValid($input);
    return true;
}

// Maps each field ID to its validation function.
const checks = {
    resourceId: validateId,
    resourceTitle: validateTitle,
    category: validateCategory,
    format: validateFormat,
    resourceLink: validateLink,
    price: validatePrice
};

function formatPrice(price) {
    return price === 0 ? "Free" : "$" + price.toFixed(2);
}

// Build the resource table. Uses .text() so user input is shown as plain text.
function renderTable() {
    const $body = $("#resourceTableBody").empty();

    if (resources.length === 0) {
        $body.append(
            $("<tr>").append(
                $("<td>").attr("colspan", 8).addClass("text-center text-muted").text("No resources yet.")
            )
        );
        return;
    }

    resources.forEach(function (item, index) {
        const $row = $("<tr>").addClass("resource-row").attr(
            "data-search",
            (item.id + " " + item.title + " " + item.category).toLowerCase()
        );

        const $linkCell = $("<td>");

        if (item.link) {
            $linkCell.append(
                $("<a>")
                    .attr({ href: item.link, target: "_blank", rel: "noopener noreferrer" })
                    .text("Open")
            );
        } else {
            $linkCell.text("-");
        }

        $row.append(
            $("<td>").text(item.id),
            $("<td>").text(item.title),
            $("<td>").text(item.category),
            $("<td>").text(item.format),
            $linkCell,
            $("<td>").text(formatPrice(item.price)),
            $("<td>").text(item.notes === "" ? "-" : item.notes),
            $("<td>").addClass("text-nowrap").append(
                $("<button>")
                    .attr({ type: "button", "data-index": index })
                    .addClass("btn btn-outline-primary btn-sm me-1 edit-btn")
                    .text("Edit"),
                $("<button>")
                    .attr({ type: "button", "data-index": index })
                    .addClass("btn btn-outline-danger btn-sm delete-btn")
                    .text("Delete")
            )
        );

        $body.append($row);
    });

    $body.append(
        $("<tr>").attr("id", "noMatchRow").addClass("d-none").append(
            $("<td>").attr("colspan", 8).addClass("text-center text-muted").text("No resources match your search.")
        )
    );

    applySearch();
}

// Display the current resource array as JSON.
function renderJson() {
    $("#resourceJson").text(JSON.stringify(resources, null, 2));
}

// jQuery search: hide rows whose ID, title, or category don't match.
function applySearch() {
    const term = $("#resourceSearch").val().trim().toLowerCase();
    let visible = 0;

    $(".resource-row").each(function () {
        const match = $(this).attr("data-search").includes(term);
        $(this).toggle(match);
        if (match) {
            visible++;
        }
    });

    $("#noMatchRow").toggleClass("d-none", visible > 0 || resources.length === 0);
}

// Save to localStorage first, then update the table and JSON.
function commit(updated) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
        return false;
    }

    resources = updated;
    renderTable();
    renderJson();
    return true;
}

// Put the form back into "add" mode.
function resetForm() {
    editingIndex = -1;
    $("#resourceForm")[0].reset();
    $("#resourceForm .form-control, #resourceForm .form-select").each(function () {
        clearField($(this));
    });
    $("#formTitle").text("Add a Resource");
    $("#saveResource").text("Add Resource");
    $("#cancelEdit").addClass("d-none");
}

// Load a resource into the form for editing.
function editResource(index) {
    const item = resources[index];

    resetForm();
    editingIndex = index;

    $("#resourceId").val(item.id);
    $("#resourceTitle").val(item.title);
    $("#category").val(item.category);
    $("#format").val(item.format);
    $("#resourceLink").val(item.link);
    $("#price").val(item.price);
    $("#notes").val(item.notes);

    $("#formTitle").text("Edit Resource " + item.id);
    $("#saveResource").text("Save Changes");
    $("#cancelEdit").removeClass("d-none");
    showMessage("info", "Editing " + item.id + ". Submit to save your changes.");

    $("#resourceForm")[0].scrollIntoView({ behavior: "smooth" });
    $("#resourceTitle").trigger("focus");
}

// Remove a resource after confirming.
function deleteResource(index) {
    const item = resources[index];

    if (!confirm("Delete " + item.id + " (" + item.title + ")?")) {
        return;
    }

    const updated = resources.slice();
    updated.splice(index, 1);

    if (!commit(updated)) {
        showMessage("danger", "Could not save. Check your browser storage settings.");
        return;
    }

    // Keep editingIndex pointing at the right item after the list shifts.
    if (editingIndex === index) {
        resetForm();
    } else if (editingIndex > index) {
        editingIndex--;
    }

    showMessage("success", item.id + " was deleted.");
}

// Use saved browser data if it exists, otherwise load resources.json.
function loadResources() {
    let saved = null;

    try {
        saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (error) {
        saved = null;
    }

    if (Array.isArray(saved)) {
        resources = saved.map(normalizeResource);
        renderTable();
        renderJson();
        return;
    }

    $.getJSON("resources.json")
        .done(function (data) {
            resources = Array.isArray(data) ? data.map(normalizeResource) : [];
            commit(resources);
        })
        .fail(function () {
            showMessage("warning", "Could not load resources.json. Open the site with a local server such as Live Server.");
            renderTable();
            renderJson();
        });
}

// Set up event handlers once the page has loaded.
$(function () {
    // Validate every field before adding or updating a resource.
    $("#resourceForm").on("submit", function (event) {
        event.preventDefault();

        const results = fields.map(function (id) {
            return checks[id]();
        });

        if (results.includes(false)) {
            showMessage("danger", "Please fix the fields marked in red.");
            $("#resourceForm .is-invalid").first().trigger("focus");
            return;
        }

        const item = normalizeResource({
            id: $("#resourceId").val(),
            title: $("#resourceTitle").val(),
            category: $("#category").val(),
            format: $("#format").val(),
            link: $("#resourceLink").val(),
            price: Number(Number($("#price").val()).toFixed(2)),
            notes: $("#notes").val()
        });

        const updating = editingIndex !== -1;
        const updated = resources.slice();

        if (updating) {
            updated[editingIndex] = item;
        } else {
            updated.push(item);
        }

        if (!commit(updated)) {
            showMessage("danger", "Could not save. Check your browser storage settings.");
            return;
        }

        resetForm();
        showMessage("success", updating ? item.id + " was updated." : item.id + " was added.");
    });

    // Recheck invalid fields while the user types.
    $.each(checks, function (id, check) {
        $("#" + id).on("input change", function () {
            if ($(this).hasClass("is-invalid")) {
                check();
            }
        });
    });

    $("#cancelEdit").on("click", function () {
        resetForm();
        clearMessage();
    });

    // Edit and Delete buttons are created later, so listen on the table body.
    $("#resourceTableBody").on("click", ".edit-btn", function () {
        editResource(Number($(this).attr("data-index")));
    });

    $("#resourceTableBody").on("click", ".delete-btn", function () {
        deleteResource(Number($(this).attr("data-index")));
    });

    $("#resourceSearch").on("input", applySearch);

    // Download the current resources as a JSON file.
    $("#downloadResources").on("click", function () {
        const file = new Blob([JSON.stringify(resources, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(file);
        const $link = $("<a>").attr({ href: url, download: "resources.json" }).appendTo("body");

        $link[0].click();
        $link.remove();

        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
    });

    loadResources();
});
