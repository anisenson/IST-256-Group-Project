// Contribution: React submission form, validation, JSON, and AJAX.
const h = React.createElement;

const CATEGORIES = [
    "Python",
    "HTML/CSS",
    "JavaScript",
    "SQL",
    "Other"
];

function SubmissionApp() {
    const [form, setForm] = React.useState({
        title: "",
        speaker: "",
        email: "",
        category: "",
        abstract: ""
    });

    const [errors, setErrors] = React.useState({});
    const [payload, setPayload] = React.useState(null);
    const [notice, setNotice] = React.useState({
        type: "",
        text: ""
    });
    const [sending, setSending] = React.useState(false);

    // React manages the current field values.
    function handleChange(event) {
        const { name, value } = event.target;

        setForm(function (previous) {
            return { ...previous, [name]: value };
        });

        setPayload(null);
        setNotice({ type: "", text: "" });
        setErrors(function (previous) {
            return { ...previous, [name]: "" };
        });
    }

    // Validate all required fields before sending.
    function validate(data) {
        const found = {};

        if (data.title.length < 3 || data.title.length > 100) {
            found.title = "Enter a title between 3 and 100 characters.";
        }

        if (data.speaker.length < 2 || data.speaker.length > 100) {
            found.speaker = "Enter a name between 2 and 100 characters.";
        }

        if (
            data.email.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
        ) {
            found.email = "Enter a valid email address.";
        }

        if (!CATEGORIES.includes(data.category)) {
            found.category = "Please choose a category.";
        }

        if (data.abstract.length < 20 || data.abstract.length > 1000) {
            found.abstract =
                "Describe your activity in 20 to 1000 characters.";
        }

        return found;
    }

    // Serialize valid input and POST it to the Node.js REST endpoint.
    async function handleSubmit(event) {
        event.preventDefault();

        if (sending) {
            return;
        }

        const data = {
            title: form.title.trim(),
            speaker: form.speaker.trim(),
            email: form.email.trim(),
            category: form.category,
            abstract: form.abstract.trim()
        };

        const found = validate(data);
        setErrors(found);

        if (Object.keys(found).length > 0) {
            setPayload(null);
            setNotice({
                type: "danger",
                text: "Please correct the highlighted fields."
            });
            return;
        }

        setPayload(data);
        setSending(true);
        setNotice({
            type: "info",
            text: "Validation passed. Sending your proposal..."
        });

        try {
            const response = await fetch("/api/submissions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error("Server returned status " + response.status);
            }

            setNotice({
                type: "success",
                text: "Your proposal was submitted successfully for review."
            });
        } catch (error) {
            setNotice({
                type: "danger",
                text:
                    "Your proposal was not confirmed by the server. " +
                    "Check that the Node.js backend is running. " +
                    error.message
            });
        } finally {
            setSending(false);
        }
    }

    // Reusable labeled input with Bootstrap validation feedback.
    function field(name, label, type) {
        const properties = {
            id: name,
            name: name,
            value: form[name],
            onChange: handleChange,
            disabled: sending,
            required: true,
            className:
                "form-control" + (errors[name] ? " is-invalid" : ""),
            "aria-invalid": Boolean(errors[name]),
            "aria-describedby": name + "Error"
        };

        let control;

        if (name === "category") {
            control = h(
                "select",
                {
                    ...properties,
                    className:
                        "form-select" +
                        (errors[name] ? " is-invalid" : "")
                },
                h("option", { value: "" }, "Choose a category"),
                ...CATEGORIES.map(function (category) {
                    return h(
                        "option",
                        { key: category, value: category },
                        category
                    );
                })
            );
        } else if (name === "abstract") {
            control = h("textarea", {
                ...properties,
                rows: 5,
                minLength: 20,
                maxLength: 1000
            });
        } else {
            control = h("input", {
                ...properties,
                type: type,
                maxLength: name === "email" ? 254 : 100
            });
        }

        return h(
            "div",
            { className: "mb-3" },
            h("label", { htmlFor: name, className: "form-label" }, label),
            control,
            h(
                "div",
                { id: name + "Error", className: "invalid-feedback" },
                errors[name]
            )
        );
    }

    return h(
        "div",
        { className: "row justify-content-center" },
        h(
            "div",
            { className: "col-12 col-md-8" },
            h(
                "section",
                { className: "card" },
                h(
                    "div",
                    { className: "card-body" },
                    h("h2", { className: "card-title" }, "Proposal Details"),
                    h("p", null, "All fields are required."),

                    h(
                        "form",
                        { onSubmit: handleSubmit, noValidate: true },
                        field("title", "Activity Title", "text"),
                        field("speaker", "Speaker / Organizer Name", "text"),
                        field("email", "Email Address", "email"),
                        field("category", "Category"),
                        field(
                            "abstract",
                            "Activity Description (20–1000 characters)"
                        ),
                        h(
                            "button",
                            {
                                type: "submit",
                                className: "btn btn-primary",
                                disabled: sending
                            },
                            sending ? "Submitting..." : "Submit Proposal"
                        )
                    ),

                    h(
                        "div",
                        { role: "status", "aria-live": "polite" },
                        notice.text && h(
                            "div",
                            {
                                className:
                                    "alert alert-" + notice.type + " mt-3"
                            },
                            notice.text
                        )
                    ),

                    payload && h(
                        "section",
                        { className: "mt-4" },
                        h("h3", { className: "h5" }, "Submission JSON"),
                        h(
                            "pre",
                            {
                                className: "bg-light border rounded p-3",
                                style: {
                                    whiteSpace: "pre-wrap",
                                    overflowWrap: "anywhere"
                                }
                            },
                            JSON.stringify(payload, null, 2)
                        )
                    )
                )
            )
        )
    );
}

ReactDOM.createRoot(
    document.getElementById("submissionApp")
).render(h(SubmissionApp));