// products.js - Product Management page: form validation, table, jQuery search, and JSON
// Products are loaded from and saved to the MySQL database through the
// Node.js /api/products routes (AJAX). Written by Nasser Almalki.

const API_URL = "api/products";

let resources = [];
let editingIndex = -1;

const fields = ["resourceId", "resourceTitle", "category", "format", "price"];

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

// Give every product the same fields and types.
function normalizeResource(item) {
    const price = Number(item.price);

    return {
        id: String(item.id || "").trim().toUpperCase(),
        title: String(item.title || "").trim(),
        category: String(item.category || "").trim(),
        format: String(item.format || "").trim(),
        price: Number.isFinite(price) && price >= 0 ? price : 0,
        notes: String(item.notes || "").trim()
    };
}

// ID must look like P009 and not belong to another product.
function validateId() {
    const $input = $("#resourceId");
    const id = $input.val().trim().toUpperCase();

    if (id === "") {
        showError($input, "Please enter a product ID.");
        return false;
    }

    if (!/^P\d{3,}$/.test(id)) {
        showError($input, "ID must be the letter P followed by at least 3 digits, like P009.");
        return false;
    }

    const duplicate = resources.some(function (item, index) {
        return index !== editingIndex && item.id === id;
    });

    if (duplicate) {
        showError($input, "That ID is already used by another product.");
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
    price: validatePrice
};

function formatPrice(price) {
    return price === 0 ? "Free" : "$" + price.toFixed(2);
}

// Build the product table. Uses .text() so user input is shown as plain text.
function renderTable() {
    const $body = $("#resourceTableBody").empty();

    if (resources.length === 0) {
        $body.append(
            $("<tr>").append(
                $("<td>").attr("colspan", 7).addClass("text-center text-muted").text("No products yet.")
            )
        );
        return;
    }

    resources.forEach(function (item, index) {
        const $row = $("<tr>").addClass("resource-row").attr(
            "data-search",
            (item.id + " " + item.title + " " + item.category).toLowerCase()
        );

        $row.append(
            $("<td>").text(item.id),
            $("<td>").text(item.title),
            $("<td>").text(item.category),
            $("<td>").text(item.format),
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
            $("<td>").attr("colspan", 7).addClass("text-center text-muted").text("No products match your search.")
        )
    );

    applySearch();
}

// Display the current product list (as stored in the database) as JSON.
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

// Pull the error message out of a failed AJAX request.
function errorText(xhr) {
    if (xhr.status === 0) {
        return "Could not reach the server. Is it running (node server.js)?";
    }
    return (xhr.responseJSON && xhr.responseJSON.error) || "Something went wrong (status " + xhr.status + ").";
}

// AJAX helper: send JSON to the Node.js server.
function sendJson(method, url, data) {
    return $.ajax({
        url: url,
        method: method,
        contentType: "application/json",
        data: data === undefined ? undefined : JSON.stringify(data)
    });
}

// Put the form back into "add" mode.
function resetForm() {
    editingIndex = -1;
    $("#resourceForm")[0].reset();
    $("#resourceForm .form-control, #resourceForm .form-select").each(function () {
        clearField($(this));
    });
    $("#resourceId").prop("readonly", false);
    $("#formTitle").text("Add a Product");
    $("#saveResource").text("Add Product");
    $("#cancelEdit").addClass("d-none");
}

// Load a product into the form for editing.
function editResource(index) {
    const item = resources[index];

    resetForm();
    editingIndex = index;

    $("#resourceId").val(item.id);
    $("#resourceTitle").val(item.title);
    $("#category").val(item.category);
    // Add the product's format to the list if the dropdown doesn't have it yet.
    if ($("#format option").filter(function () { return this.value === item.format; }).length === 0) {
        $("#format").append($("<option>").val(item.format).text(item.format));
    }
    $("#format").val(item.format);
    $("#price").val(item.price);
    $("#notes").val(item.notes);

    // The ID is the product's key in the database, so it can't change while editing.
    $("#resourceId").prop("readonly", true);
    $("#formTitle").text("Edit Product " + item.id);
    $("#saveResource").text("Save Changes");
    $("#cancelEdit").removeClass("d-none");
    showMessage("info", "Editing " + item.id + ". Submit to save your changes.");

    $("#resourceForm")[0].scrollIntoView({ behavior: "smooth" });
    $("#resourceTitle").trigger("focus");
}

// DELETE: remove a product from the database after confirming.
function deleteResource(index) {
    const item = resources[index];

    if (!confirm("Delete " + item.id + " (" + item.title + ")?")) {
        return;
    }

    sendJson("DELETE", API_URL + "/" + encodeURIComponent(item.id))
        .done(function () {
            if (editingIndex !== -1) {
                resetForm();
            }
            loadResources();
            showMessage("success", item.id + " was deleted from the database.");
        })
        .fail(function (xhr) {
            showMessage("danger", errorText(xhr));
        });
}

// READ: load every product from the database with jQuery AJAX.
function loadResources() {
    $.getJSON(API_URL)
        .done(function (data) {
            resources = Array.isArray(data) ? data.map(normalizeResource) : [];
            renderTable();
            renderJson();
        })
        .fail(function (xhr) {
            showMessage("warning", "Could not load products. " + errorText(xhr));
            renderTable();
            renderJson();
        });
}

// Set up event handlers once the page has loaded.
$(function () {
    // Validate every field, then CREATE (POST) or UPDATE (PUT) the product in the database.
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
            price: Number(Number($("#price").val()).toFixed(2)),
            notes: $("#notes").val()
        });

        const updating = editingIndex !== -1;
        const request = updating
            ? sendJson("PUT", API_URL + "/" + encodeURIComponent(item.id), {
                title: item.title,
                category: item.category,
                format: item.format,
                price: item.price,
                notes: item.notes
            })
            : sendJson("POST", API_URL, item);

        $("#saveResource").prop("disabled", true);

        request
            .done(function () {
                resetForm();
                loadResources(); // reload so the table shows what is really in the database
                showMessage("success", updating
                    ? item.id + " was updated in the database."
                    : item.id + " was added to the database.");
            })
            .fail(function (xhr) {
                showMessage("danger", errorText(xhr));
            })
            .always(function () {
                $("#saveResource").prop("disabled", false);
            });
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

    // Download the current products as a JSON file.
    $("#downloadResources").on("click", function () {
        const file = new Blob([JSON.stringify(resources, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(file);
        const $link = $("<a>").attr({ href: url, download: "products.json" }).appendTo("body");

        $link[0].click();
        $link.remove();

        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
    });

    loadResources();
});
