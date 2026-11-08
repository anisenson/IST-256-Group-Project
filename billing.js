// AngularJS app for the Billing Details page
//Work by Elliot Buona

angular.module('billingApp', [])

  // Custom validator: card number must be 13-19 digits and pass the Luhn check
  .directive('cardNumber', function () {
    return {
      require: 'ngModel',
      link: function (scope, el, attrs, ctrl) {
        ctrl.$validators.cardNumber = function (value) {
          if (!value) return true;
          var digits = value.replace(/[\s-]/g, '');
          if (!/^\d{13,19}$/.test(digits)) return false;

          // Luhn check
          var sum = 0;
          var alt = false;
          for (var i = digits.length - 1; i >= 0; i--) {
            var n = parseInt(digits.charAt(i), 10);
            if (alt) {
              n *= 2;
              if (n > 9) n -= 9;
            }
            sum += n;
            alt = !alt;
          }
          return sum % 10 === 0;
        };
      }
    };
  })

  // Custom validator: expiration must be MM/YY and not in the past
  .directive('cardExpiry', function () {
    return {
      require: 'ngModel',
      link: function (scope, el, attrs, ctrl) {
        ctrl.$validators.cardExpiry = function (value) {
          if (!value) return true;
          var m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value);
          if (!m) return false;
          var month = parseInt(m[1], 10);
          var year = 2000 + parseInt(m[2], 10);
          var now = new Date();
          var curYear = now.getFullYear();
          var curMonth = now.getMonth() + 1;
          return year > curYear || (year === curYear && month >= curMonth);
        };
      }
    };
  })

  .controller('BillingController', ['$http', function ($http) {
    var vm = this;

    // Shipping options with placeholder prices
    vm.shippingMethods = [
      { name: 'Standard', cost: 5.99 },
      { name: 'Express', cost: 12.99 },
      { name: 'Overnight', cost: 24.99 }
    ];

    // Loads cart items saved by the cart page
    vm.items = [];
    try {
      vm.items = JSON.parse(localStorage.getItem('cart')) || [];
    } catch (e) {
      vm.items = [];
    }

    // Form data is bound to the inputs
    vm.form = {
      fullName: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      cardNumber: '',
      expiration: '',
      securityCode: '',
      shippingMethod: vm.shippingMethods[0].name,
      total: 0
    };

    vm.sending = false;
    vm.success = '';
    vm.error = '';

    // Sums item prices times quantities
    vm.subtotal = function () {
      return vm.items.reduce(function (sum, i) {
        return sum + i.price * i.quantity;
      }, 0);
    };
    
    // Costs of the selected shipping method
    vm.shippingCost = function () {
      var m = vm.shippingMethods.filter(function (s) {
        return s.name === vm.form.shippingMethod;
      })[0];
      return m ? m.cost : 0;
    };

    // Recalculates the order total
    vm.updateTotal = function () {
      vm.form.total = Math.round((vm.subtotal() + vm.shippingCost()) * 100) / 100;
    };

    // Shows an error style only after the user touches a field or tries to submit incorrectly
    vm.invalid = function (field) {
      return field && field.$invalid && (field.$touched || field.$dirty || vm.attempted);
    };

    // Validates then send the billing JSON to the Node server
    vm.submit = function (form) {
      vm.attempted = true;
      vm.success = '';
      vm.error = '';
      vm.updateTotal();

      // Stop if validation fails
      if (form.$invalid) {
        vm.error = 'Please fix the highlighted fields.';
        return;
      }
      if (vm.items.length === 0) {
        vm.error = 'Your cart is empty.';
        return;
      }

      // Build the JSON the /api/billing route expects
      var payload = {
        fullName: vm.form.fullName,
        address: vm.form.address,
        city: vm.form.city,
        state: vm.form.state.toUpperCase(),
        zip: vm.form.zip,
        cardNumber: vm.form.cardNumber.replace(/[\s-]/g, ''),
        expiration: vm.form.expiration,
        securityCode: vm.form.securityCode,
        items: vm.items,
        shippingMethod: vm.form.shippingMethod,
        total: vm.form.total
      };

      // AJAX POST to backend
      vm.sending = true;
      $http.post('/api/billing', payload)
        .then(function () {
          vm.success = 'Order received. Thank you!';
          vm.form.cardNumber = '';
          vm.form.securityCode = '';
        })
        .catch(function () {
          vm.error = 'Could not submit billing details. Is the server running?';
        })
        .finally(function () {
          vm.sending = false;
        });
    };

    // Set back the starting total
    vm.updateTotal();
  }]);
