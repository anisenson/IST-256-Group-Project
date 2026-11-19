// validation.js - Member signup form validation (Nasser Almalki)

const form = document.getElementById("signupForm");
const message = document.getElementById("message");
const submitButton = document.getElementById("submitButton");

// Mark an invalid field and show its error.
function showError(input, text) {
    input.classList.remove("is-valid");
    input.classList.add("is-invalid");
    document.getElementById(input.id + "Error").textContent = text;
}

// Mark a valid field.
function showValid(input) {
    input.classList.remove("is-invalid");
    input.classList.add("is-valid");
    document.getElementById(input.id + "Error").textContent = "";
}

// Remove validation styling and error text.
function clearField(input) {
    input.classList.remove("is-invalid", "is-valid");
    document.getElementById(input.id + "Error").textContent = "";
}

function clearErrors() {
    form.querySelectorAll(".form-control").forEach(clearField);
    message.textContent = "";
    message.className = "mt-3";
}

function validateName() {
    const input = document.getElementById("fullName");
    const name = input.value.trim();

    if (name === "") {
        showError(input, "Please enter your full name.");
        return false;
    }

    if (!/^[A-Za-z]+([ '-][A-Za-z]+)*$/.test(name)) {
        showError(input, "Name can only contain letters, spaces, hyphens, and apostrophes.");
        return false;
    }

    if (!name.includes(" ")) {
        showError(input, "Please enter your first and last name.");
        return false;
    }

    showValid(input);
    return true;
}

function validateEmail() {
    const input = document.getElementById("email");
    const email = input.value.trim();

    if (email === "") {
        showError(input, "Please enter your email address.");
        return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError(input, "Please enter a valid email, like name@example.com.");
        return false;
    }

    showValid(input);
    return true;
}

function validateAge() {
    const input = document.getElementById("age");
    const age = Number(input.value);

    if (input.value.trim() === "") {
        showError(input, "Please enter your age.");
        return false;
    }

    if (!Number.isInteger(age) || age < 16 || age > 99) {
        showError(input, "Age must be a whole number between 16 and 99.");
        return false;
    }

    showValid(input);
    return true;
}

function validateAddress() {
    const input = document.getElementById("address");
    const address = input.value.trim();

    if (address === "") {
        showError(input, "Please enter your address.");
        return false;
    }

    if (address.length < 5) {
        showError(input, "Address looks too short.");
        return false;
    }

    showValid(input);
    return true;
}

function validatePhone() {
    const input = document.getElementById("phone");
    const phone = input.value.trim();

    if (phone === "") {
        clearField(input);
        return true;
    }

    const digits = phone.replace(/\D/g, "");

    if (!/^[\d\s()+.-]+$/.test(phone) || digits.length !== 10) {
        showError(input, "Phone number must have 10 digits, like 814-555-1234.");
        return false;
    }

    showValid(input);
    return true;
}

// Validate every field before adding or updating a member.
form.addEventListener("submit", function (event) {
    event.preventDefault();

    const nameOk = validateName();
    const emailOk = validateEmail();
    const ageOk = validateAge();
    const addressOk = validateAddress();
    const phoneOk = validatePhone();

    if (!(nameOk && emailOk && ageOk && addressOk && phoneOk)) {
        message.className = "alert alert-danger mt-3";
        message.textContent = "Please fix the fields marked in red.";
        form.querySelector(".is-invalid").focus();
        return;
    }

    const member = {
        fullName: document.getElementById("fullName").value.trim(),
        email: document.getElementById("email").value.trim(),
        age: Number(document.getElementById("age").value),
        address: document.getElementById("address").value.trim(),
        phone: document.getElementById("phone").value.trim()
    };

    const updating = editingIndex !== -1;

    if (!saveMember(member)) {
        message.className = "alert alert-danger mt-3";
        message.textContent = "Could not save. Check your browser storage settings.";
        return;
    }

    form.reset();
    form.querySelectorAll(".form-control").forEach(clearField);
    submitButton.textContent = "Submit";

    message.className = "alert alert-success mt-3";
    message.textContent = updating
        ? "Member updated successfully!"
        : "Thanks, " + member.fullName + "! You're signed up.";
});

// Recheck invalid fields while the user types.
const checks = {
    fullName: validateName,
    email: validateEmail,
    age: validateAge,
    address: validateAddress,
    phone: validatePhone
};

for (const id in checks) {
    document.getElementById(id).addEventListener("input", function () {
        if (this.classList.contains("is-invalid")) {
            checks[id]();
        }
    });
}