// validation.js - Member signup form validation (Nasser Almalki)
// Checks every field when the form is submitted and shows an error
// under any field that is wrong. If everything is valid, it builds a
// member object and passes it to saveMember() in script.js.

const form = document.getElementById("signupForm");
const message = document.getElementById("message");

// Marks a field red and puts the error text in its error div
function showError(input, text) {
    input.classList.remove("is-valid");
    input.classList.add("is-invalid");
    document.getElementById(input.id + "Error").textContent = text;
}

// Marks a field green
function showValid(input) {
    input.classList.remove("is-invalid");
    input.classList.add("is-valid");
}

// Removes red/green from a field
function clearField(input) {
    input.classList.remove("is-invalid", "is-valid");
}

function validateName() {
    const input = document.getElementById("fullName");
    const name = input.value.trim();

    if (name === "") {
        showError(input, "Please enter your full name.");
        return false;
    }
    // letters only, words can be separated by a space, hyphen, or apostrophe
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
    // something@something.something, no spaces
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

    // phone is optional, so an empty box is fine
    if (phone === "") {
        clearField(input);
        return true;
    }
    // allow formats like (814) 555-1234 by only counting the digits
    const digits = phone.replace(/\D/g, "");
    if (!/^[\d\s()+.-]+$/.test(phone) || digits.length !== 10) {
        showError(input, "Phone number must have 10 digits, like 814-555-1234.");
        return false;
    }
    showValid(input);
    return true;
}

form.addEventListener("submit", function (event) {
    // stop the page from reloading
    event.preventDefault();

    // run every check (not just until the first error) so all errors show at once
    const nameOk = validateName();
    const emailOk = validateEmail();
    const ageOk = validateAge();
    const addressOk = validateAddress();
    const phoneOk = validatePhone();

    if (nameOk && emailOk && ageOk && addressOk && phoneOk) {
        const member = {
            fullName: document.getElementById("fullName").value.trim(),
            email: document.getElementById("email").value.trim(),
            age: Number(document.getElementById("age").value),
            address: document.getElementById("address").value.trim(),
            phone: document.getElementById("phone").value.trim()
        };

        // saveMember is written in script.js by the storage person
        if (typeof saveMember === "function") {
            saveMember(member);
        }

        message.className = "alert alert-success mt-3";
        message.textContent = "Thanks, " + member.fullName + "! You're signed up.";

        form.reset();
        form.querySelectorAll(".form-control").forEach(clearField);
    } else {
        message.className = "alert alert-danger mt-3";
        message.textContent = "Please fix the fields marked in red.";
    }
});

// once a field has an error, re-check it while the user types
// so the red goes away as soon as it's fixed
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
