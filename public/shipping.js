// AngularJS app for the Shipping Details page
// Work by Elliot Buona
// Talks to the REST API in server.js: GET/POST /api/shipping, PUT/DELETE /api/shipping/:id

angular.module('shippingApp', [])

  .controller('ShippingController', ['$http', function ($http) {
    var vm = this;

    // Matches the ZIP rule in server.js: 12345 or 12345-6789
    var ZIP_PATTERN = /^\d{5}(-\d{4})?$/;
    vm.zipPattern = ZIP_PATTERN;

    vm.addresses = [];      // saved addresses returned by the server
    vm.editingId = null;    // API id (e.g. "SHIP-3") being edited, or null when adding a new one
    vm.sending = false;     // true while a request is in flight (disables the button)
    vm.success = '';
    vm.error = '';

    // Returns an empty form; country defaults to USA
    function blankForm() {
      return { fullName: '', address: '', city: '', state: '', zip: '', country: 'USA' };
    }
    vm.form = blankForm();

    // Turns a failed $http response into a readable message (server sends { error: "..." })
    function errorText(response, fallback) {
      if (response && response.data && response.data.error) return response.data.error;
      return fallback;
    }

    // GET /api/shipping -> fills the saved addresses table
    vm.load = function () {
      $http.get('/api/shipping').then(function (response) {
        vm.addresses = response.data;
      }, function (response) {
        vm.error = errorText(response, 'Could not load saved addresses. Is the server running (npm.cmd start)?');
      });
    };

    // Returns true if a field has an error and the user has touched it or tried to submit
    vm.showError = function (form, field) {
      return field.$invalid && (field.$touched || form.$submitted);
    };

    // Creates (POST) or updates (PUT) depending on whether we are editing
    vm.submit = function (form) {
      vm.success = '';
      vm.error = '';

      // Stop here if client-side validation fails; the messages appear under each field
      if (form.$invalid) return;

      var editing = vm.editingId !== null;
      var request = editing
        ? $http.put('/api/shipping/' + encodeURIComponent(vm.editingId), vm.form)
        : $http.post('/api/shipping', vm.form);

      vm.sending = true;
      request.then(function () {
        vm.success = editing ? 'Shipping address updated.' : 'Shipping address saved.';
        vm.reset(form);
        vm.load();
      }, function (response) {
        vm.error = errorText(response, 'Could not save the address. Please try again.');
      }).finally(function () {
        vm.sending = false;
      });
    };

    // Copies a saved address into the form so it can be changed
    vm.edit = function (item) {
      vm.success = '';
      vm.error = '';
      vm.editingId = item.id;
      vm.form = {
        fullName: item.fullName,
        address: item.address,
        city: item.city,
        state: item.state,
        zip: item.zip,
        country: item.country
      };
      window.scrollTo(0, 0);
    };

    // Clears the form and leaves edit mode
    vm.reset = function (form) {
      vm.editingId = null;
      vm.form = blankForm();
      if (form) {
        form.$setPristine();
        form.$setUntouched();
      }
    };

    // DELETE /api/shipping/:id after the user confirms
    vm.remove = function (item) {
      if (!window.confirm('Delete the address for ' + item.fullName + '?')) return;
      vm.success = '';
      vm.error = '';
      $http.delete('/api/shipping/' + encodeURIComponent(item.id)).then(function () {
        vm.success = 'Shipping address deleted.';
        if (vm.editingId === item.id) vm.reset();
        vm.load();
      }, function (response) {
        vm.error = errorText(response, 'Could not delete the address.');
      });
    };

    vm.load();
  }]);
