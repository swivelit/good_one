
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

const _storage = FlutterSecureStorage();
const _backendUrl = 'http://127.0.0.1:5000/api';

class AdminCouponsScreen extends StatefulWidget {
  const AdminCouponsScreen({super.key});

  @override
  State<AdminCouponsScreen> createState() => _AdminCouponsScreenState();
}

class _AdminCouponsScreenState extends State<AdminCouponsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();
  final _valueController = TextEditingController();
  final _minPurchaseController = TextEditingController(text: '0');
  final _maxDiscountController = TextEditingController();
  final _usageLimitController = TextEditingController();
  final _expiryController = TextEditingController();

  String _discountType = 'percentage';
  bool _loading = false;
  bool _creating = false;
  List<Map<String, dynamic>> _coupons = [];

  @override
  void initState() {
    super.initState();
    _expiryController.text = DateTime.now()
        .add(const Duration(days: 30))
        .toIso8601String()
        .substring(0, 10);
    _fetchCoupons();
  }

  @override
  void dispose() {
    _codeController.dispose();
    _valueController.dispose();
    _minPurchaseController.dispose();
    _maxDiscountController.dispose();
    _usageLimitController.dispose();
    _expiryController.dispose();
    super.dispose();
  }

  Future<String?> _getToken() async {
    final token = await _storage.read(key: 'auth_token');
    if (token == null || token.isEmpty) {
      _showMessage('Please log in as an admin first.');
      return null;
    }
    return token;
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Future<void> _fetchCoupons() async {
    setState(() => _loading = true);

    try {
      final token = await _getToken();
      if (token == null) return;

      final response = await http.get(
        Uri.parse('$_backendUrl/coupons'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 20));

      final data = jsonDecode(response.body);

      if (response.statusCode != 200 ||
          data is! Map ||
          data['success'] != true) {
        throw Exception(
          data is Map
              ? data['message'] ?? 'Could not load coupons.'
              : 'Unexpected server response.',
        );
      }

      final raw = data['coupons'];
      if (raw is! List) {
        throw Exception('Unexpected coupon list response.');
      }

      if (!mounted) return;
      setState(() {
        _coupons = raw
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
      });
    } catch (error) {
      _showMessage(
        error.toString().replaceFirst('Exception: ', ''),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createCoupon() async {
    if (!_formKey.currentState!.validate()) return;

    final expiry = DateTime.tryParse(_expiryController.text.trim());
    if (expiry == null) {
      _showMessage('Enter a valid expiry date.');
      return;
    }

    // Send the selected expiry date at the end of that day.
    final expiresAt = DateTime(
      expiry.year,
      expiry.month,
      expiry.day,
      23,
      59,
      59,
    ).toIso8601String();

    final value = double.tryParse(_valueController.text.trim());
    final minimum = double.tryParse(
      _minPurchaseController.text.trim(),
    );
    final maximumText = _maxDiscountController.text.trim();
    final maximum = maximumText.isEmpty
        ? null
        : double.tryParse(maximumText);
    final limitText = _usageLimitController.text.trim();
    final limit = limitText.isEmpty ? null : int.tryParse(limitText);

    if (value == null ||
        !value.isFinite ||
        value <= 0 ||
        (_discountType == 'percentage' && value > 100)) {
      _showMessage('Enter a valid discount value.');
      return;
    }

    if (minimum == null || !minimum.isFinite || minimum < 0) {
      _showMessage('Enter a valid minimum purchase amount.');
      return;
    }

    if (maximumText.isNotEmpty &&
        (maximum == null || !maximum.isFinite || maximum <= 0)) {
      _showMessage('Maximum discount must be a positive amount.');
      return;
    }

    if (limitText.isNotEmpty && (limit == null || limit <= 0)) {
      _showMessage('Usage limit must be a positive whole number.');
      return;
    }

    setState(() => _creating = true);

    try {
      final token = await _getToken();
      if (token == null) return;

      final body = <String, dynamic>{
        'code': _codeController.text.trim().toUpperCase(),
        'discountType': _discountType,
        'discountValue': value,
        'minPurchase': minimum,
        'expiresAt': expiresAt,
      };

      if (maximum != null) body['maxDiscount'] = maximum;
      if (limit != null) body['usageLimit'] = limit;

      final response = await http.post(
        Uri.parse('$_backendUrl/coupons'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(body),
      ).timeout(const Duration(seconds: 20));

      final data = jsonDecode(response.body);

      if (response.statusCode != 201 ||
          data is! Map ||
          data['success'] != true) {
        throw Exception(
          data is Map
              ? data['message'] ?? 'Could not create coupon.'
              : 'Unexpected server response.',
        );
      }

      _codeController.clear();
      _valueController.clear();
      _minPurchaseController.text = '0';
      _maxDiscountController.clear();
      _usageLimitController.clear();

      _showMessage('Coupon created successfully.');
      await _fetchCoupons();
    } catch (error) {
      _showMessage(
        error.toString().replaceFirst('Exception: ', ''),
      );
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  Future<void> _deactivateCoupon(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Deactivate coupon?'),
        content: const Text(
          'Customers will no longer be able to use this coupon.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Deactivate'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final token = await _getToken();
      if (token == null) return;

      final response = await http.patch(
        Uri.parse('$_backendUrl/coupons/$id/deactivate'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 20));

      final data = jsonDecode(response.body);

      if (response.statusCode != 200 ||
          data is! Map ||
          data['success'] != true) {
        throw Exception(
          data is Map
              ? data['message'] ?? 'Could not deactivate coupon.'
              : 'Unexpected server response.',
        );
      }

      _showMessage('Coupon deactivated.');
      await _fetchCoupons();
    } catch (error) {
      _showMessage(
        error.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  String _money(dynamic value) {
    final amount = value is num
        ? value
        : double.tryParse(value?.toString() ?? '') ?? 0;
    return '₹${amount.toStringAsFixed(2)}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Coupon Management'),
        actions: [
          IconButton(
            tooltip: 'Refresh coupons',
            onPressed: _loading ? null : _fetchCoupons,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchCoupons,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              color: Colors.white,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Create a coupon',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _codeController,
                        textCapitalization: TextCapitalization.characters,
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(
                            RegExp(r'[a-zA-Z0-9_-]'),
                          ),
                          LengthLimitingTextInputFormatter(40),
                        ],
                        decoration: const InputDecoration(
                          labelText: 'Coupon code',
                          hintText: 'WELCOME10',
                          border: OutlineInputBorder(),
                        ),
                        validator: (value) {
                          final code = value?.trim() ?? '';
                          if (code.length < 3 ||
                              !RegExp(r'^[a-zA-Z0-9_-]+$')
                                  .hasMatch(code)) {
                            return 'Use 3–40 letters, numbers, _ or -';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _discountType,
                        decoration: const InputDecoration(
                          labelText: 'Discount type',
                          border: OutlineInputBorder(),
                        ),
                        items: const [
                          DropdownMenuItem(
                            value: 'percentage',
                            child: Text('Percentage (%)'),
                          ),
                          DropdownMenuItem(
                            value: 'fixed',
                            child: Text('Fixed amount (₹)'),
                          ),
                        ],
                        onChanged: (value) {
                          if (value != null) {
                            setState(() => _discountType = value);
                          }
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _valueController,
                        keyboardType:
                            const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Discount value',
                          border: OutlineInputBorder(),
                        ),
                        validator: (value) {
                          final number = double.tryParse(
                            value?.trim() ?? '',
                          );
                          if (number == null ||
                              !number.isFinite ||
                              number <= 0) {
                            return 'Enter a positive number';
                          }
                          if (_discountType == 'percentage' &&
                              number > 100) {
                            return 'Percentage cannot exceed 100';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _minPurchaseController,
                        keyboardType:
                            const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Minimum purchase (₹)',
                          border: OutlineInputBorder(),
                        ),
                        validator: (value) {
                          final number = double.tryParse(
                            value?.trim() ?? '',
                          );
                          if (number == null ||
                              !number.isFinite ||
                              number < 0) {
                            return 'Enter zero or a positive amount';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _maxDiscountController,
                        keyboardType:
                            const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Maximum discount (₹, optional)',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _usageLimitController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Total usage limit (optional)',
                          hintText: 'Leave blank for unlimited',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _expiryController,
                        keyboardType: TextInputType.datetime,
                        decoration: const InputDecoration(
                          labelText: 'Expiry date (YYYY-MM-DD)',
                          hintText: '2026-12-31',
                          border: OutlineInputBorder(),
                        ),
                        validator: (value) {
                          final date = DateTime.tryParse(
                            value?.trim() ?? '',
                          );
                          if (date == null) {
                            return 'Enter a valid date as YYYY-MM-DD';
                          }
                          if (!date.isAfter(
                            DateTime.now().subtract(
                              const Duration(days: 1),
                            ),
                          )) {
                            return 'Expiry date must not be in the past';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 18),
                      FilledButton.icon(
                        onPressed: _creating ? null : _createCoupon,
                        icon: _creating
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.add),
                        label: Text(
                          _creating ? 'Creating...' : 'Create coupon',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Existing coupons',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Text('${_coupons.length}'),
              ],
            ),
            const SizedBox(height: 8),
            if (_loading && _coupons.isEmpty)
              const Padding(
                padding: EdgeInsets.all(28),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_coupons.isEmpty)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'No coupons found. Create your first coupon above.',
                  textAlign: TextAlign.center,
                ),
              )
            else
              ..._coupons.map((coupon) {
                final active = coupon['isActive'] == true;
                final type =
                    coupon['discountType']?.toString() ?? 'fixed';
                final value = coupon['discountValue'];
                final discount = type == 'percentage'
                    ? '$value%'
                    : _money(value);
                final expiry = coupon['expiresAt'] == null
                    ? 'Unknown'
                    : coupon['expiresAt']
                        .toString()
                        .split('T')
                        .first;
                final count = coupon['redemptionCount'] ?? 0;
                final id = coupon['id']?.toString() ?? '';

                return Card(
                  color: Colors.white,
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    isThreeLine: true,
                    leading: CircleAvatar(
                      child: Icon(
                        active
                            ? Icons.local_offer_outlined
                            : Icons.block_outlined,
                      ),
                    ),
                    title: Text(
                      coupon['code']?.toString() ?? 'Unknown code',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    subtitle: Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        '$discount discount\n'
                        'Expires: $expiry · Redemptions: $count\n'
                        '${active ? 'Active' : 'Inactive'}',
                      ),
                    ),
                    trailing: active
                        ? IconButton(
                            tooltip: 'Deactivate coupon',
                            onPressed: id.isEmpty
                                ? null
                                : () => _deactivateCoupon(id),
                            icon: const Icon(
                              Icons.block,
                              color: Colors.red,
                            ),
                          )
                        : const Icon(
                            Icons.check_circle_outline,
                            color: Colors.green,
                          ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
