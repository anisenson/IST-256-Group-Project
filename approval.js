const h = React.createElement;
const categories = ["Python", "HTML/CSS", "JavaScript", "SQL", "Other"];

function ApprovalApp() {
    const [items, setItems] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [busy, setBusy] = React.useState(false);
    const [filter, setFilter] = React.useState("all");
    const [message, setMessage] = React.useState("");
    const [error, setError] = React.useState("");
    const [editingId, setEditingId] = React.useState(null);
    const [form, setForm] = React.useState({});
    const [errors, setErrors] = React.useState({});

    // Read JSON responses; DELETE may return 204 with no body.
    async function request(url, options) {
        const response = await fetch(url, options);
        const text = await response.text();
        let data = null;

        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error("The server returned an invalid response.");
            }
        }

        if (!response.ok) {
            throw new Error(
                (data && data.error) ||
                "Request failed (" + response.status + ")."
            );
        }

        return data;
    }

    function clearNotices() {
        setMessage("");
        setError("");
    }

    async function loadItems() {
        setLoading(true);
        clearNotices();

        try {
            const data = await request("/api/submissions");

            if (!Array.isArray(data)) {
                throw new Error("Invalid proposal data.");
            }

            setItems(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    React.useEffect(function () {
        loadItems();
    }, []);

    function replaceItem(updated) {
        setItems(previous =>
            previous.map(item =>
                item.id === updated.id ? updated : item
            )
        );
    }

    async function updateStatus(id, status) {
        if (busy || loading) return;

        setBusy(true);
        clearNotices();

        try {
            const updated = await request(
                "/api/submissions/" + encodeURIComponent(id),
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status })
                }
            );

            replaceItem(updated);
            setMessage("Proposal " + status + " successfully.");
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    // Load the selected proposal into the edit form.
    function startEdit(item) {
        clearNotices();
        setErrors({});
        setEditingId(item.id);
        setForm({
            title: item.title,
            speaker: item.speaker,
            email: item.email,
            category: item.category,
            abstract: item.abstract
        });
    }

    function cancelEdit() {
        setEditingId(null);
        setForm({});
        setErrors({});
    }

    function changeField(event) {
        const { name, value } = event.target;

        setForm(previous => ({ ...previous, [name]: value }));
        setErrors(previous => ({ ...previous, [name]: "" }));
    }

    // Validate the same fields required by the submission form.
    function validate(data) {
        const problems = {};

        if (data.title.length < 3 || data.title.length > 100) {
            problems.title = "Title must be 3–100 characters.";
        }

        if (data.speaker.length < 2 || data.speaker.length > 100) {
            problems.speaker = "Name must be 2–100 characters.";
        }

        if (
            data.email.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
        ) {
            problems.email = "Please enter a valid email address.";
        }

        if (!categories.includes(data.category)) {
            problems.category = "Please select a category.";
        }

        if (data.abstract.length < 20 || data.abstract.length > 1000) {
            problems.abstract = "Description must be 20–1000 characters.";
        }

        return problems;
    }

    async function saveEdit(event) {
        event.preventDefault();
        if (busy || loading) return;

        clearNotices();

        const data = {};
        ["title", "speaker", "email", "category", "abstract"].forEach(
            name => {
                data[name] = String(form[name] || "").trim();
            }
        );

        const problems = validate(data);
        setErrors(problems);

        if (Object.keys(problems).length > 0) {
            setError("Please fix the fields marked in red.");
            return;
        }

        setBusy(true);

        try {
            const updated = await request(
                "/api/submissions/" + encodeURIComponent(editingId),
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                }
            );

            replaceItem(updated);
            cancelEdit();
            setMessage("Proposal updated successfully.");
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function deleteItem(item) {
        if (busy || loading) return;

        if (!window.confirm('Delete "' + item.title + '"?')) {
            return;
        }

        setBusy(true);
        clearNotices();

        try {
            await request(
                "/api/submissions/" + encodeURIComponent(item.id),
                { method: "DELETE" }
            );

            setItems(previous =>
                previous.filter(proposal => proposal.id !== item.id)
            );

            if (editingId === item.id) {
                cancelEdit();
            }

            setMessage("Proposal deleted successfully.");
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    // Build a Bootstrap input with an associated validation message.
    function editField(name, label, type = "text") {
        const invalid = Boolean(errors[name]);
        const props = {
            id: "edit-" + name,
            name,
            value: form[name] || "",
            onChange: changeField,
            disabled: busy,
            required: true,
            className:
                (name === "category" ? "form-select" : "form-control") +
                (invalid ? " is-invalid" : ""),
            "aria-invalid": invalid,
            "aria-describedby": "edit-" + name + "-error"
        };

        let input;

        if (name === "category") {
            input = h(
                "select",
                props,
                h("option", { value: "" }, "Choose a category"),
                ...categories.map(category =>
                    h("option", {
                        key: category,
                        value: category
                    }, category)
                )
            );
        } else if (name === "abstract") {
            input = h("textarea", {
                ...props,
                rows: 5,
                minLength: 20,
                maxLength: 1000
            });
        } else {
            input = h("input", {
                ...props,
                type,
                maxLength: name === "email" ? 254 : 100
            });
        }

        return h(
            "div",
            { className: "mb-3" },
            h("label", {
                htmlFor: props.id,
                className: "form-label"
            }, label),
            input,
            h("div", {
                id: "edit-" + name + "-error",
                className: "invalid-feedback"
            }, errors[name] || "")
        );
    }

    const visibleItems = items.filter(
        item => filter === "all" || item.status === filter
    );

    const locked = busy || loading;

    return h(
        "div",
        null,

        h("div", {
            className: "d-flex flex-wrap gap-3 align-items-end mb-4"
        },
            h("div", null,
                h("label", {
                    htmlFor: "statusFilter",
                    className: "form-label"
                }, "Filter by status"),
                h("select", {
                    id: "statusFilter",
                    className: "form-select",
                    value: filter,
                    disabled: locked,
                    onChange: event => setFilter(event.target.value)
                },
                    ...["all", "pending", "approved", "rejected"].map(
                        status => h("option", {
                            key: status,
                            value: status
                        }, status)
                    )
                )
            ),
            h("button", {
                type: "button",
                className: "btn btn-primary",
                disabled: locked || editingId !== null,
                onClick: loadItems
            }, "Refresh")
        ),

        h("div", { role: "status", "aria-live": "polite" },
            loading && h("p", null, "Loading proposals..."),
            message && h("p", {
                className: "alert alert-success"
            }, message),
            error && h("p", {
                className: "alert alert-danger"
            }, error)
        ),

        // The edit form remains visible even if the status filter changes.
        editingId !== null && h("section", {
            className: "card mb-4"
        },
            h("div", { className: "card-body" },
                h("h2", { className: "h4" }, "Edit Proposal"),
                h("form", { onSubmit: saveEdit, noValidate: true },
                    editField("title", "Title"),
                    editField("speaker", "Speaker / Organizer Name"),
                    editField("email", "Email Address", "email"),
                    editField("category", "Category"),
                    editField("abstract", "Activity Description"),
                    h("div", { className: "d-flex gap-2" },
                        h("button", {
                            type: "submit",
                            className: "btn btn-primary",
                            disabled: locked
                        }, busy ? "Saving..." : "Save Changes"),
                        h("button", {
                            type: "button",
                            className: "btn btn-outline-secondary",
                            disabled: locked,
                            onClick: cancelEdit
                        }, "Cancel")
                    )
                )
            )
        ),

        !loading && !error && visibleItems.length === 0 &&
            h("p", null, "No proposals match this status."),

        ...visibleItems.map(function (item) {
            const colors = {
                pending: "text-bg-warning",
                approved: "text-bg-success",
                rejected: "text-bg-danger"
            };

            return h("article", {
                key: item.id,
                className: "card mb-4"
            },
                h("div", { className: "card-body" },
                    h("h2", { className: "h4" }, item.title),
                    h("p", null, "Speaker: " + item.speaker),
                    h("p", null, "Email: " + item.email),
                    h("p", null, "Category: " + item.category),
                    h("p", {
                        style: { whiteSpace: "pre-wrap" }
                    }, item.abstract),
                    h("p", null, "Status: ",
                        h("span", {
                            className: "badge " +
                                (colors[item.status] || "text-bg-secondary")
                        }, item.status)
                    ),
                    h("div", {
                        className: "d-flex flex-wrap gap-2"
                    },
                        h("button", {
                            type: "button",
                            className: "btn btn-success",
                            disabled:
                                locked ||
                                editingId !== null ||
                                item.status === "approved",
                            onClick: () => updateStatus(item.id, "approved")
                        }, "Approve"),
                        h("button", {
                            type: "button",
                            className: "btn btn-danger",
                            disabled:
                                locked ||
                                editingId !== null ||
                                item.status === "rejected",
                            onClick: () => updateStatus(item.id, "rejected")
                        }, "Reject"),
                        h("button", {
                            type: "button",
                            className: "btn btn-outline-primary",
                            disabled: locked || editingId !== null,
                            onClick: () => startEdit(item)
                        }, "Edit"),
                        h("button", {
                            type: "button",
                            className: "btn btn-outline-danger",
                            disabled: locked || editingId !== null,
                            onClick: () => deleteItem(item)
                        }, "Delete")
                    )
                )
            );
        }),

        h("h2", { className: "h4 mt-4" }, "Proposal Data (JSON)"),
        h("pre", {
            className: "bg-white border rounded p-3",
            style: {
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere"
            }
        }, JSON.stringify(items, null, 2))
    );
}

ReactDOM.createRoot(
    document.getElementById("approvalApp")
).render(h(ApprovalApp));