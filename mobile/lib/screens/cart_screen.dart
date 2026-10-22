
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class CartItem {
  final String productId;
  final String title;
  final double price;
  final String? imageUrl;
  int quantity;

  CartItem({
    required this.productId,
    required this.title,
    required this.price,
    this.imageUrl,
    this.quantity = 1,
  });
}

class CartController extends ChangeNotifier {
  final Map<String, CartItem> _items = {};

  List<CartItem> get items => List.unmodifiable(_items.values);

  int get itemCount =>
      _items.values.fold(0, (sum, item) => sum + item.quantity);

  double get subtotal => _items.values.fold(
        0,
        (sum, item) => sum + item.price * item.quantity,
      );

  void add(CartItem item) {
    final existing = _items[item.productId];
    if (existing != null) {
      existing.quantity++;
    } else {
      _items[item.productId] = item;
    }
    notifyListeners();
  }

  void updateQuantity(String productId, int quantity) {
    final item = _items[productId];
    if (item == null) return;

    if (quantity <= 0) {
      _items.remove(productId);
    } else {
      item.quantity = quantity;
    }
    notifyListeners();
  }

  void remove(String productId) {
    _items.remove(productId);
    notifyListeners();
  }

  void clear() {
    _items.clear();
    notifyListeners();
  }
}

class CartScreen extends StatefulWidget {
  final CartController cart;

  const CartScreen({super.key, required this.cart});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  static const _storage = FlutterSecureStorage();
  static const _apiUrl = 'http://10.0.2.2:5000/api';

  bool _checkingOut = false;

  String money(double amount) => '₹${amount.toStringAsFixed(2)}';


Future<void> _checkout() async {
  if (_checkingOut || widget.cart.items.isEmpty) return;

  final token = await _storage.read(key: 'auth_token');
  if (token == null || token.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Please log in before checkout.')),
    );
    return;
  }

  final subtotal = widget.cart.subtotal;
  String? selectedCoupon;
  String paymentMethod = 'offline';
  double discount = 0;
  double finalTotal = subtotal;
  List<Map<String, dynamic>> coupons = [];

  setState(() => _checkingOut = true);

  try {
    final couponResponse = await http.get(
      Uri.parse('$_apiUrl/coupons/available'),
      headers: {'Authorization': 'Bearer $token'},
    ).timeout(const Duration(seconds: 30));

    if (couponResponse.statusCode >= 200 &&
        couponResponse.statusCode < 300) {
      final data = jsonDecode(couponResponse.body);
      if (data is Map && data['coupons'] is List) {
        coupons = (data['coupons'] as List)
            .whereType<Map>()
            .map((c) => Map<String, dynamic>.from(c))
            .toList();
      }
    }

    if (!mounted) return;

    final choice = await showDialog<Map<String, dynamic>>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        String? draftCoupon;
        String draftPayment = 'offline';

        return StatefulBuilder(
          builder: (context, refreshDialog) => AlertDialog(
            title: const Text('Checkout'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Subtotal: ${money(subtotal)}'),
                  const SizedBox(height: 16),
                  const Text(
                    'Available coupons',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  if (coupons.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Text('No coupons are currently available.'),
                    )
                  else
                    ...coupons.map((coupon) {
                      final code = coupon['code']?.toString() ?? '';
                      final minimum =
                          (coupon['minPurchase'] as num?)?.toDouble() ?? 0;
                      final type = coupon['discountType']?.toString();
                      final value =
                          (coupon['discountValue'] as num?)?.toDouble() ?? 0;
                      final eligible = subtotal >= minimum;

                      return RadioListTile<String?>(
                        contentPadding: EdgeInsets.zero,
                        value: code,
                        groupValue: draftCoupon,
                        onChanged: eligible
                            ? (value) => refreshDialog(
                                  () => draftCoupon = value,
                                )
                            : null,
                        title: Text(code),
                        subtitle: Text(
                          '${type == 'percentage' ? '${value.toStringAsFixed(0)}% off' : '${money(value)} off'}'
                          '${eligible ? '' : ' • Minimum spend ${money(minimum)}'}',
                        ),
                      );
                    }),
                  RadioListTile<String?>(
                    contentPadding: EdgeInsets.zero,
                    value: null,
                    groupValue: draftCoupon,
                    onChanged: (value) =>
                        refreshDialog(() => draftCoupon = value),
                    title: const Text('Continue without a coupon'),
                  ),
                  const Divider(),
                  const Text(
                    'Payment method',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  RadioListTile<String>(
                    contentPadding: EdgeInsets.zero,
                    value: 'offline',
                    groupValue: draftPayment,
                    onChanged: (value) => refreshDialog(
                      () => draftPayment = value!,
                    ),
                    title: const Text('Pay offline'),
                    subtitle: const Text('Payment remains pending'),
                  ),
                  RadioListTile<String>(
                    contentPadding: EdgeInsets.zero,
                    value: 'online',
                    groupValue: draftPayment,
                    onChanged: (value) => refreshDialog(
                      () => draftPayment = value!,
                    ),
                    title: const Text('Online payment'),
                    subtitle: const Text(
                      'Test mode only — no payment is collected',
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(
                  dialogContext,
                  {
                    'couponCode': draftCoupon,
                    'paymentMethod': draftPayment,
                  },
                ),
                child: const Text('Continue'),
              ),
            ],
          ),
        );
      },
    );

    if (choice == null || !mounted) return;

    selectedCoupon = choice['couponCode'] as String?;
    paymentMethod = choice['paymentMethod'] as String;

    if (selectedCoupon != null) {
      final validationResponse = await http.post(
        Uri.parse('$_apiUrl/coupons/validate'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'code': selectedCoupon,
          'purchaseAmount': subtotal,
        }),
      ).timeout(const Duration(seconds: 30));

      final validation = jsonDecode(validationResponse.body);
      if (validationResponse.statusCode < 200 ||
          validationResponse.statusCode >= 300 ||
          validation is! Map ||
          validation['success'] != true) {
        throw Exception(
          validation is Map
              ? validation['message']?.toString() ?? 'Coupon validation failed.'
              : 'Coupon validation failed.',
        );
      }

      discount = (validation['discount'] as num).toDouble();
      finalTotal = (validation['finalAmount'] as num).toDouble();
    }

    if (!mounted) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Confirm order'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Subtotal: ${money(subtotal)}'),
            Text('Coupon: ${selectedCoupon ?? 'Not applied'}'),
            Text('Discount: ${money(discount)}'),
            Text('Total: ${money(finalTotal)}'),
            const SizedBox(height: 8),
            Text('Payment: ${paymentMethod == 'online' ? 'Online' : 'Offline'}'),
            const SizedBox(height: 8),
            const Text('Test checkout only; no payment will be collected.'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Back'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Place order'),
          ),
        ],
      ),
    );

    if (confirm != true || !mounted) return;

    setState(() => _checkingOut = true);

    final items = widget.cart.items
        .map((item) => {
              'productId': item.productId,
              'quantity': item.quantity,
            })
        .toList();

    final response = await http.post(
      Uri.parse('$_apiUrl/orders'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'items': items,
        'paymentMethod': paymentMethod,
        if (selectedCoupon != null) 'couponCode': selectedCoupon,
      }),
    ).timeout(const Duration(seconds: 30));

    final decoded = jsonDecode(response.body);
    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        decoded is! Map ||
        decoded['success'] != true) {
      throw Exception(
        decoded is Map
            ? decoded['message']?.toString() ?? 'Unable to place your order.'
            : 'Unable to place your order.',
      );
    }

    final order = decoded['order'];
    if (order is! Map || order['id'] == null) {
      throw Exception('The server response did not contain an order ID.');
    }

    final orderNumber =
        order['orderNumber']?.toString() ?? order['id'].toString();
    widget.cart.clear();

    if (!mounted) return;

    final actualMethod = order['paymentMethod']?.toString() ?? paymentMethod;
    final paymentStatus = order['paymentStatus']?.toString() ?? 'pending';
    final actualCoupon = order['couponCode']?.toString();
    final actualDiscount = (order['discount'] as num?)?.toDouble() ?? 0;
    final actualTotal = (order['total'] as num?)?.toDouble() ?? finalTotal;

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        icon: const Icon(
          Icons.check_circle_outline,
          color: Colors.green,
          size: 48,
        ),
        title: const Text('Order placed successfully!'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Order number: $orderNumber'),
              const SizedBox(height: 16),
              const Text(
                'Payment details',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              Text('Method: $actualMethod'),
              Text('Status: ${paymentStatus.toUpperCase()}'),
              const Divider(height: 24),
              const Text(
                'Coupon & pricing',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              Text(
                actualCoupon != null && actualCoupon.isNotEmpty
                    ? 'Coupon: $actualCoupon'
                    : 'Coupon: Not applied',
              ),
              Text('Discount: ${money(actualDiscount)}'),
              Text(
                'Total: ${money(actualTotal)}',
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (paymentStatus.toLowerCase() == 'pending')
                const Padding(
                  padding: EdgeInsets.only(top: 12),
                  child: Text(
                    'Your order is created, but payment is still pending.',
                    style: TextStyle(fontSize: 12),
                  ),
                ),
            ],
          ),
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Done'),
          ),
        ],
      ),
    );

    if (mounted) Navigator.of(context).pop();
  } catch (error) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(error.toString().replaceFirst('Exception: ', '')),
      ),
    );
  } finally {
    if (mounted) setState(() => _checkingOut = false);
  }
}


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My cart')),
      body: AnimatedBuilder(
        animation: widget.cart,
        builder: (context, _) {
          final items = widget.cart.items;

          if (items.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.shopping_cart_outlined, size: 64),
                  SizedBox(height: 12),
                  Text('Your cart is empty'),
                ],
              ),
            );
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              for (final item in items)
                Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 76,
                          height: 76,
                          child: item.imageUrl == null
                              ? const Icon(Icons.image_outlined, size: 40)
                              : Image.network(
                                  item.imageUrl!,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, _, _) =>
                                      const Icon(Icons.broken_image_outlined),
                                ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(money(item.price)),
                              Row(
                                children: [
                                  IconButton(
                                    onPressed: () => widget.cart.updateQuantity(
                                      item.productId,
                                      item.quantity - 1,
                                    ),
                                    icon: const Icon(
                                      Icons.remove_circle_outline,
                                    ),
                                  ),
                                  Text('${item.quantity}'),
                                  IconButton(
                                    onPressed: () => widget.cart.updateQuantity(
                                      item.productId,
                                      item.quantity + 1,
                                    ),
                                    icon: const Icon(
                                      Icons.add_circle_outline,
                                    ),
                                  ),
                                  const Spacer(),
                                  IconButton(
                                    onPressed: () =>
                                        widget.cart.remove(item.productId),
                                    icon: const Icon(Icons.delete_outline),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Subtotal',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      Text(
                        money(widget.cart.subtotal),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Test checkout only. No payment is collected; '
                'the order will remain pending.',
                style: TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _checkingOut ? null : _checkout,
                child: _checkingOut
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Place order'),
              ),
            ],
          );
        },
      ),
    );
  }
}
