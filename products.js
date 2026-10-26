// cart.js Product searching the shopping cart item validation, JSON, and AJAX implementation for the IST256 group project.


const RESOURCES_KEY = "clubResources";
const CART_KEY = "clubCart";
const API_URL = "api/cart";
 
let resources = [];
let cart = [];
 
// Show "F  ree" for 0, otherwise a dollar amount with two decimal places1
function formatPrice(price) {
    return price === 0 ? "Free" : "$" + price.toFixed(2);
}
 
// Quantity must be a positive whole number.
function isValidQuantity(value) {
    return /^[1-9]\d*$/.test(String(value).trim());
}
 
// Give every resource the same fields and types, and make sure the price is a number >= 0.
function normalizeResource(item) {
    const price = Number(item.price);
 
    return {
        id: String(item.id || "").trim().toUpperCase(),
        title: String(item.title || "").trim(),
        category: String(item.category || "").trim(),
        format: String(item.format || "").trim(),
        price: Number.isFinite(price) && price >= 0 ? price : 0
    };
}
 
// Save the cart in  locally
function saveCart() {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (error) {
        showCartMessage("warning", "Cart could not be saved in this browser.");
    }
}
 
// Load the saved cart from local storage or start as with an empty cart if there is no saved data 
function loadCart() {
    try {
        const saved = JSON.parse(localStorage.getItem(CART_KEY));
 
        if (Array.isArray(saved)) {
            cart = saved
                .map(function (item) {
                    const base = normalizeResource(item);
                    base.quantity = Number(item.quantity);
                    return base;
                })
                .filter(function (item) {
                    return item.id !== "" && Number.isInteger(item.quantity) && item.quantity > 0;
                });
        }
    } catch (error) {
        cart = [];
    }
}
 
// Shows a message under the cart.
function showCartMessage(type, text) {
    $("#cartMessage").attr("class", "mt-3 alert alert-" + type).text(text);
}
 
function clearCartMessage() {
    $("#cartMessage").attr("class", "mt-3").text("");
}
 

function renderProducts(list) {
    const $body = $("#productTableBody").empty();
 
    if (list.length === 0) {
        $body.append(
            $("<tr>").append(
                $("<td>").attr("colspan", 6).addClass("text-center text-muted").text("No resources to display.")
            )
        );
        return;
    }
 
    list.forEach(function (item) {
        $body.append(
            $("<tr>").append(
                $("<td>").text(item.id),
                $("<td>").text(item.title),
                $("<td>").text(item.category),
                $("<td>").text(item.format),
                $("<td>").text(formatPrice(item.price)),
                $("<td>").append(
                    $("<button>")
                        .attr({ type: "button", "data-id": item.id })
                        .addClass("btn btn-success btn-sm add-btn")
                        .text("Add to Cart")
                )
            )
        );
    });
}
 
// jQuery search filters by title, ID, and category
function runSearch() {
    const term = $("#productSearch").val().trim().toLowerCase();
 
    if (resources.length === 0) {
        renderProducts([]);
        return;
    }
 
    const matches = resources.filter(function (item) {
        return (item.id + " " + item.title + " " + item.category).toLowerCase().includes(term);
    });
 
    renderProducts(matches);
 
    if (term === "") {
        $("#searchMessage").text("Showing all " + resources.length + " resources.");
    } else if (matches.length === 0) {
        $("#searchMessage").text("No resources match \"" + term + "\".");
    } else {
        $("#searchMessage").text(matches.length + " resource(s) match \"" + term + "\".");
    }
}
 
// sum or cart items total price
function cartTotal() {
    return cart.reduce(function (sum, item) {
        return sum + item.price * item.quantity;
    }, 0);
}
 
// json data for API
function buildPayload() {
    return cart.map(function (item) {
        return {
            id: item.id,
            title: item.title,
            category: item.category,
            format: item.format,
            price: item.price,
            quantity: item.quantity,
            subtotal: Number((item.price * item.quantity).toFixed(2))
        };
    });
}
 
// Updates the total price and the JSON payload. saves the cart locally
function updateTotals() {
    $("#cartTotal").text("$" + cartTotal().toFixed(2));
    $("#cartJson").text(JSON.stringify(buildPayload(), null, 2));
    saveCart();
}
 
// cart table
function renderCart() {
    const $body = $("#cartTableBody").empty();
 
    $("#emptyCartMessage").toggleClass("d-none", cart.length > 0);
 
    cart.forEach(function (item, index) {
        const $qty = $("<input>")
            .attr({
                type: "number",
                min: 1,
                step: 1,
                value: item.quantity,
                "data-index": index,
                "aria-label": "Quantity for " + item.title
            })
            .addClass("form-control form-control-sm qty-input")
            .css("max-width", "6rem");
 
        $body.append(
            $("<tr>").append(
                $("<td>").text(item.id),
                $("<td>").text(item.title),
                $("<td>").text(item.category),
                $("<td>").text(item.format),
                $("<td>").text(formatPrice(item.price)),
                $("<td>").append(
                    $qty,
                    $("<div>").addClass("invalid-feedback").text("Enter a positive whole number.")
                ),
                $("<td>").addClass("subtotal").text("$" + (item.price * item.quantity).toFixed(2)),
                $("<td>").append(
                    $("<button>")
                        .attr({ type: "button", "data-index": index })
                        .addClass("btn btn-outline-danger btn-sm remove-btn")
                        .text("Remove")
                )
            )
        );
    });
 
    updateTotals();
}
 


//CART FUNCTIONS (add subtotal, remove item, validate quantity, submit cart, load resources, and set up event handlers)

// add a resource to the cart
function addToCart(id) {
    const product = resources.find(function (item) {
        return item.id === id;
    });
 
    if (!product) {
        return;
    }
 
    const existing = cart.find(function (item) {
        return item.id === id;
    });
 
    if (existing) {
        existing.quantity++;
    } else {
        cart.push(Object.assign({}, product, { quantity: 1 }));
    }
 
    renderCart();
    showCartMessage("success", product.title + " was added to your cart.");
}
 
//remove one item 
function removeFromCart(index) {
    const item = cart[index];
 
    cart.splice(index, 1);
    renderCart();
    showCartMessage("info", item.title + " was removed from your cart.");
}
 
//check every quantity box and mark bad ones
function allQuantitiesValid() {
    let valid = true;
 
    $("#cartTableBody .qty-input").each(function () {
        if (!isValidQuantity($(this).val())) {
            $(this).addClass("is-invalid");
            valid = false;
        }
    });
 
    return valid;
}
 
// after validation send cart to the API with AJAX (no api)
function submitCart() {
    clearCartMessage();
 
    if (cart.length === 0) {
        showCartMessage("danger", "Your cart is empty. Add at least one resource before submitting.");
        return;
    }
 
    if (!allQuantitiesValid()) {
        showCartMessage("danger", "Please fix the quantities marked in red. Use positive whole numbers.");
        $("#cartTableBody .is-invalid").first().trigger("focus");
        return;
    }
 
    $("#submitCart").prop("disabled", true);
 
    $.ajax({
        url: API_URL,
        method: "POST",
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify(buildPayload())
    })
        .done(function () {
            showCartMessage("success", "Cart submitted successfully.");
        })
        .fail(function () {
            showCartMessage("warning", "The cart could not be sent because the RESTful API is not available yet.");
        })
        .always(function () {
            $("#submitCart").prop("disabled", false);
        });
}
 
//Uses local browser data if it exists or otherwise load resources.json file with AJAX. If neither is available it shows an error message.
function loadResources() {
    let saved = null;
 
    try {
        saved = JSON.parse(localStorage.getItem(RESOURCES_KEY));
    } catch (error) {
        saved = null;
    }
 
    if (Array.isArray(saved)) {
        resources = saved.map(normalizeResource);
        runSearch();
        return;
    }
 
    $.getJSON("resources.json")
        .done(function (data) {
            resources = Array.isArray(data) ? data.map(normalizeResource) : [];
            runSearch();
        })
        .fail(function () {
            $("#searchMessage").text("Could not load resources. Open the site with a local server such as Live Server.");
            renderProducts([]);
        });
}
 
//page event handlers
$(function () {
    loadCart();
    renderCart();
    loadResources();
 
    // search button and typing.
    $("#searchForm").on("submit", function (event) {
        event.preventDefault();
        runSearch();
    });
 
    $("#productSearch").on("input", runSearch);
 
    $("#clearSearch").on("click", function () {
        $("#productSearch").val("").trigger("focus");
        runSearch();
    });
 
    // buttons in the product table and cart table.
    $("#productTableBody").on("click", ".add-btn", function () {
        addToCart($(this).attr("data-id"));
    });
 
    $("#cartTableBody").on("click", ".remove-btn", function () {
        removeFromCart(Number($(this).attr("data-index")));
    });
 
    // check the quantity input boxes for valid values and update the subtotal and total price.
    $("#cartTableBody").on("input change", ".qty-input", function () {
        const $input = $(this);
        const value = $input.val();
 
        if (!isValidQuantity(value)) {
            $input.addClass("is-invalid");
            return;
        }
 
        $input.removeClass("is-invalid");
 
        const item = cart[Number($input.attr("data-index"))];
        item.quantity = Number(value);
        $input.closest("tr").find(".subtotal").text("$" + (item.price * item.quantity).toFixed(2));
        updateTotals();
    });
 
    $("#cartForm").on("submit", function (event) {
        event.preventDefault();
        submitCart();
    });
 
    // empties the cart after confirmation and shows a message to the user
    $("#clearCart").on("click", function () {
        if (cart.length === 0) {
            return;
        }
 
        if (!confirm("Remove all items from your cart?")) {
            return;
        }
 
        cart = [];
        renderCart();
        showCartMessage("info", "Your cart was cleared.");
    });
 
    // download the cart as a JSON file.
    $("#downloadCart").on("click", function () {
        const file = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(file);
        const $link = $("<a>").attr({ href: url, download: "cart.json" }).appendTo("body");
 
        $link[0].click();
        $link.remove();
 
        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
    });
});