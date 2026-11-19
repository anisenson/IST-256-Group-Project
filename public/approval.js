const h = React.createElement;

function ApprovalApp() {
    const [items, setItems] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [busy, setBusy] = React.useState(false);
    const [filter, setFilter] = React.useState("all");
    const [message, setMessage] = React.useState("");
    const [error, setError] = React.useState("");

    // Retrieve proposals from Node.js.
    async function loadItems() {
        setLoading(true);
        setError("");

        try {
            const response = await fetch("/api/submissions");

            if (!response.ok) {
                throw new Error("Could not load proposals.");
            }

            const data = await response.json();

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

    // Send an approval or rejection to the server.
    async function updateStatus(id, status) {
        if (busy) return;

        setBusy(true);
        setMessage("");
        setError("");

        try {
            const response = await fetch(
                "/api/submissions/" + encodeURIComponent(id),
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ status: status })
                }
            );

            const updated = await response.json();

            if (!response.ok) {
                throw new Error(updated.error || "Update failed.");
            }

            setItems(function (previous) {
                return previous.map(function (item) {
                    return item.id === updated.id ? updated : item;
                });
            });

            setMessage("Proposal " + status + " successfully.");
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    const visibleItems = items.filter(function (item) {
        return filter === "all" || item.status === filter;
    });

    return h(
        "div",
        null,

        h(
            "div",
            { className: "d-flex flex-wrap gap-3 align-items-end mb-4" },
            h(
                "div",
                null,
                h(
                    "label",
                    { htmlFor: "statusFilter", className: "form-label" },
                    "Filter by status"
                ),
                h(
                    "select",
                    {
                        id: "statusFilter",
                        className: "form-select",
                        value: filter,
                        onChange: event => setFilter(event.target.value)
                    },
                    ...["all", "pending", "approved", "rejected"].map(
                        status => h(
                            "option",
                            { key: status, value: status },
                            status
                        )
                    )
                )
            ),
            h(
                "button",
                {
                    type: "button",
                    className: "btn btn-primary",
                    disabled: loading || busy,
                    onClick: loadItems
                },
                "Refresh"
            )
        ),

        h(
            "div",
            { role: "status", "aria-live": "polite" },
            loading && h("p", null, "Loading proposals..."),
            message && h(
                "p",
                { className: "alert alert-success" },
                message
            ),
            error && h(
                "p",
                { className: "alert alert-danger" },
                error
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

            return h(
                "article",
                { key: item.id, className: "card mb-4" },
                h(
                    "div",
                    { className: "card-body" },
                    h("h2", { className: "h4" }, item.title),
                    h("p", null, "Speaker: " + item.speaker),
                    h("p", null, "Email: " + item.email),
                    h("p", null, "Category: " + item.category),
                    h(
                        "p",
                        { style: { whiteSpace: "pre-wrap" } },
                        item.abstract
                    ),
                    h(
                        "p",
                        null,
                        "Status: ",
                        h(
                            "span",
                            {
                                className:
                                    "badge " +
                                    (colors[item.status] || "text-bg-secondary")
                            },
                            item.status
                        )
                    ),
                    h(
                        "div",
                        { className: "d-flex gap-2" },
                        h(
                            "button",
                            {
                                type: "button",
                                className: "btn btn-success",
                                disabled: busy || item.status === "approved",
                                onClick: () =>
                                    updateStatus(item.id, "approved")
                            },
                            "Approve"
                        ),
                        h(
                            "button",
                            {
                                type: "button",
                                className: "btn btn-danger",
                                disabled: busy || item.status === "rejected",
                                onClick: () =>
                                    updateStatus(item.id, "rejected")
                            },
                            "Reject"
                        )
                    )
                )
            );
        }),

        h("h2", { className: "h4 mt-4" }, "Proposal Data (JSON)"),
        h(
            "pre",
            {
                className: "bg-white border rounded p-3",
                style: {
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere"
                }
            },
            JSON.stringify(items, null, 2)
        )
    );
}

ReactDOM.createRoot(
    document.getElementById("approvalApp")
).render(h(ApprovalApp));