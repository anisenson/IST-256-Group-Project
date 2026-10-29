// Your name: React RSVP form, validation, and JSON generation.
const h = React.createElement;

// Madina: RESTful service endpoint (same style as cart.js)
const API_URL = "api/rsvp";

function RSVPApp() {
    // Madina: load activities from the existing products.json using jQuery
    const [activities, setActivities] = React.useState([]);
    const [loadError, setLoadError] = React.useState("");

    React.useEffect(function () {
        $.getJSON("products.json")
            .done(function (products) {
                // Only workshops can be RSVPed to (P002 and P004 right now)
                const workshops = products.filter(function (item) {
                    return item.format.startsWith("Workshop");
                });
                setActivities(workshops);
            })
            .fail(function () {
                setLoadError("Could not load activities. Please refresh the page.");
            });
    }, []);

    const [form, setForm] = React.useState({
        name: "",
        email: "",
        activity: "",
        participation: "",
        notes: ""
    });

    const [errors, setErrors] = React.useState({});
    const [rsvpData, setRsvpData] = React.useState(null);
    const [sending, setSending] = React.useState(false);
    const [sendStatus, setSendStatus] = React.useState(null);

    // Madina: send the JSON document to the RESTful API with AJAX
    function sendRsvp(payload) {
        setSending(true);
        setSendStatus(null);

        $.ajax({
            url: API_URL,
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify(payload)
        })
            .done(function () {
                setSendStatus({ type: "success", text: "RSVP submitted successfully." });
            })
            .fail(function () {
                setSendStatus({
                    type: "warning",
                    text: "The RSVP could not be sent because the RESTful API is not available yet."
                });
            })
            .always(function () {
                setSending(false);
            });
    }

    // Update form values and clear the previous JSON result.
    function handleChange(event) {
        const { name, value } = event.target;

        setForm(function (previous) {
            return { ...previous, [name]: value };
        });

        setRsvpData(null);
        setSendStatus(null);
    }

    // Validate inputs and generate a JSON object.
    function handleSubmit(event) {
        event.preventDefault();

        const found = {};

        if (form.name.trim().length < 2) {
            found.name = "Please enter your full name.";
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
            found.email = "Please enter a valid email.";
        }

        const activity = activities.find(function (item) {
            return item.id === form.activity;
        });

        if (!activity) {
            found.activity = "Please select an activity.";
        }

        if (!["In person", "Virtual"].includes(form.participation)) {
            found.participation = "Please select a participation type.";
        }

        if (form.notes.length > 500) {
            found.notes = "Please use 500 characters or fewer.";
        }

        setErrors(found);

        if (Object.keys(found).length > 0) {
            setRsvpData(null);
            return;
        }

        const payload = {
            name: form.name.trim(),
            email: form.email.trim(),
            activityId: activity.id,
            activityTitle: activity.title,
            participation: form.participation,
            notes: form.notes.trim()
        };

        setRsvpData(payload);
        sendRsvp(payload);
    }

    // Create a labeled field with an error message.
    function field(name, label, options) {
        const properties = {
            id: name,
            name: name,
            value: form[name],
            onChange: handleChange,
            required: name !== "notes",
            "aria-invalid": Boolean(errors[name]),
            "aria-describedby": name + "Error",
            className:
                (options ? "form-select" : "form-control") +
                (errors[name] ? " is-invalid" : "")
        };

        let control;

        if (options) {
            control = h(
                "select",
                properties,
                h("option", { value: "" }, "Choose an option"),
                ...options.map(function (option) {
                    return h(
                        "option",
                        { key: option.value, value: option.value },
                        option.label
                    );
                })
            );
        } else if (name === "notes") {
            control = h("textarea", {
                ...properties,
                rows: 3,
                maxLength: 500
            });
        } else {
            control = h("input", {
                ...properties,
                type: name === "email" ? "email" : "text",
                autoComplete: name === "email" ? "email" : "name"
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
                "div",
                { className: "card" },
                h(
                    "div",
                    { className: "card-body" },

                    h("h2", { className: "card-title" }, "RSVP Details"),
                    h("p", null, "All fields are required except notes."),

                    loadError &&
                        h(
                            "p",
                            { className: "alert alert-danger", role: "alert" },
                            loadError
                        ),

                    h(
                        "form",
                        { onSubmit: handleSubmit, noValidate: true },

                        field("name", "Full Name"),
                        field("email", "Email Address"),

                        field(
                            "activity",
                            "Activity",
                            activities.map(function (item) {
                                return {
                                    value: item.id,
                                    label: item.title
                                };
                            })
                        ),

                        field("participation", "Participation Type", [
                            { value: "In person", label: "In person" },
                            { value: "Virtual", label: "Virtual" }
                        ]),

                        field("notes", "Notes (Optional)"),

                        h(
                            "button",
                            {
                                type: "submit",
                                className: "btn btn-primary",
                                disabled: sending
                            },
                            "Prepare RSVP"
                        )
                    ),

                    Object.keys(errors).length > 0 &&
                        h(
                            "p",
                            { className: "alert alert-danger mt-3", role: "alert" },
                            "Please correct the highlighted fields."
                        ),

                    rsvpData &&
                        h(
                            "section",
                            { className: "mt-4" },
                            h(
                                "p",
                                {
                                    className: "alert alert-success",
                                    role: "status"
                                },
                                "Validation successful! Your JSON is ready."
                            ),
                            h("h3", { className: "h5" }, "RSVP Data (JSON)"),
                            h(
                                "pre",
                                {
                                    className: "bg-light border rounded p-3",
                                    style: {
                                        whiteSpace: "pre-wrap",
                                        overflowWrap: "anywhere"
                                    }
                                },
                                JSON.stringify(rsvpData, null, 2)
                            ),
                            sendStatus &&
                                h(
                                    "p",
                                    {
                                        className: "alert alert-" + sendStatus.type,
                                        role: "status"
                                    },
                                    sendStatus.text
                                )
                        )
                )
            )
        )
    );
}

ReactDOM.createRoot(
    document.getElementById("rsvpApp")
).render(h(RSVPApp));