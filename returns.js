// returns.js - Returns page (Madina Aliyeva)
// jQuery: load and search products.json | AngularJS: form binding and validation | AJAX: POST the JSON

angular.module("returnsApp", []).controller("ReturnsController", function ($scope) {
    const vm = this;
    let products = [];

    vm.results = [];
    vm.items = [];
    vm.searchTerm = "";
    vm.reasons = ["Wrong item received", "Damaged or defective", "Not as described", "No longer needed"];
    vm.conditions = ["Unopened", "Opened - like new", "Used", "Damaged"];
    vm.form = { name: "", email: "", reason: null, condition: null, comments: "" };    vm.errors = {};
    vm.message = null;
    vm.payload = null;

    // jQuery: load the products
    $.getJSON("products.json").done(function (data) {
        $scope.$apply(function () {
            products = data;
            vm.search();
        });
    });

    // jQuery: search by ID, title, or category
    vm.search = function () {
        const term = $.trim(vm.searchTerm).toLowerCase();

        vm.results = $.grep(products, function (p) {
            return (p.id + " " + p.title + " " + p.category).toLowerCase().indexOf(term) !== -1;
        });
    };

    vm.add = function (product) {
        vm.items.push(product);
    };

    vm.remove = function (index) {
        vm.items.splice(index, 1);
    };

    // JavaScript validation: returns true only if every field is OK
    vm.validate = function () {
        const e = {};

        if (!vm.form.name || vm.form.name.trim().length < 2) e.name = "Please enter your full name.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vm.form.email || "")) e.email = "Please enter a valid email.";
        if (vm.items.length === 0) e.items = "Add at least one product to return.";
        if (!vm.form.reason) e.reason = "Please choose a reason.";
        if (!vm.form.condition) e.condition = "Please choose the condition.";

        vm.errors = e;
        return Object.keys(e).length === 0;
    };

    vm.submit = function () {
        vm.message = null;
        vm.payload = null;

        if (!vm.validate()) {
            vm.message = { type: "danger", text: "Please fix the highlighted fields." };
            return;
        }

        // The JSON document
        vm.payload = {
            customerName: vm.form.name.trim(),
            email: vm.form.email,
            reason: vm.form.reason,
            condition: vm.form.condition,
            comments: vm.form.comments || "",
            items: vm.items.map(function (p) {
                return { productId: p.id, productName: p.title, price: p.price };
            }),
            total: vm.items.reduce(function (sum, p) { return sum + p.price; }, 0)
        };

        // AJAX: send the JSON to the Node.js server
        $.ajax({
            url: "api/returns",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify(vm.payload)
        })
            .done(function (response) {
                $scope.$apply(function () {
                    vm.message = { type: "success", text: "Return " + response.id + " was submitted." };
                });
            })
            .fail(function () {
                $scope.$apply(function () {
                    vm.message = { type: "warning", text: "The return could not be sent because the server is not running." };
                });
            });
    };
});