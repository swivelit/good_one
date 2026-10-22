
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class MyOrdersScreen extends StatefulWidget {
  const MyOrdersScreen({super.key});

  @override
  State<MyOrdersScreen> createState() => _MyOrdersScreenState();
}

class _MyOrdersScreenState extends State<MyOrdersScreen> {
  static const _storage = FlutterSecureStorage();
  static const _apiUrl = 'http://10.0.2.2:5000/api';

  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _orders = [];
  String? _cancellingOrderId;
  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  Future<void> _loadOrders() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final token = await _storage.read(key: 'auth_token');

      if (token == null || token.isEmpty) {
        throw Exception('Please log in to view your orders.');
      }

      final response = await http
          .get(
            Uri.parse('$_apiUrl/orders/my'),
            headers: {'Authorization': 'Bearer $token'},
          )
          .timeout(const Duration(seconds: 30));

      final decoded = jsonDecode(response.body);

      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          decoded is! Map ||
          decoded['success'] != true) {
        throw Exception(
          decoded is Map
              ? decoded['message']?.toString() ?? 'Could not load orders.'
              : 'Could not load orders.',
        );
      }

      final rawOrders = decoded['orders'];

      if (rawOrders is! List) {
        throw Exception('Unexpected response from the server.');
      }

      if (!mounted) return;

      
      setState(() {
        _orders = rawOrders
            .whereType<Map>()
            .map((order) => Map<String, dynamic>.from(order))
            .toList()
          ..sort((a, b) {
            final statusA = a['status']?.toString().toLowerCase() ?? '';
            final statusB = b['status']?.toString().toLowerCase() ?? '';

            if (statusA == 'cancelled' && statusB != 'cancelled') {
              return 1;
            }
            if (statusA != 'cancelled' && statusB == 'cancelled') {
              return -1;
            }

            final dateA =
                DateTime.tryParse(a['createdAt']?.toString() ?? '') ??
                    DateTime(2000);
            final dateB =
                DateTime.tryParse(b['createdAt']?.toString() ?? '') ??
                    DateTime(2000);

            return dateB.compareTo(dateA);
          });

        _loading = false;
      });

    } catch (e) {
      if (!mounted) return;

      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  String _money(dynamic value) {
    final amount = value is num
        ? value.toDouble()
        : double.tryParse(value?.toString() ?? '') ?? 0;
    return '₹${amount.toStringAsFixed(2)}';
  }

  String _date(dynamic value) {
    final parsed = DateTime.tryParse(value?.toString() ?? '');

    if (parsed == null) return 'Date unavailable';

    final date = parsed.toLocal();
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');

    return '$day/$month/${date.year}';
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'paid':
        return Colors.green;
      case 'cancelled':
      case 'failed':
      case 'refunded':
        return Colors.red;
      case 'confirmed':
        return Colors.blue;
      default:
        return Colors.orange.shade800;
    }
  }

  Widget _statusChip(String label) {
    final color = _statusColor(label);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
  
Future<void> _cancelOrder(Map<String, dynamic> order) async {
  final orderId = order['id']?.toString();

  if (orderId == null || orderId.isEmpty || _cancellingOrderId != null) {
    return;
  }

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: const Text('Cancel order?'),
      content: const Text(
        'Are you sure you want to cancel this pending order?',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, false),
          child: const Text('Keep order'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(dialogContext, true),
          child: const Text('Cancel order'),
        ),
      ],
    ),
  );

  if (confirmed != true || !mounted) return;

  setState(() => _cancellingOrderId = orderId);

  try {
    final token = await _storage.read(key: 'auth_token');

    if (token == null || token.isEmpty) {
      throw Exception('Please log in again.');
    }

    final response = await http.patch(
      Uri.parse('$_apiUrl/orders/$orderId/cancel'),
      headers: {'Authorization': 'Bearer $token'},
    ).timeout(const Duration(seconds: 30));

    final decoded = jsonDecode(response.body);

    if (decoded is! Map ||
        response.statusCode < 200 ||
        response.statusCode >= 300 ||
        decoded['success'] != true) {
      throw Exception(
        decoded is Map
            ? decoded['message']?.toString() ?? 'Could not cancel order.'
            : 'Could not cancel order.',
      );
    }

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Order cancelled successfully.')),
    );

    await _loadOrders();
  } catch (e) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          e.toString().replaceFirst('Exception: ', ''),
        ),
      ),
    );
  } finally {
    if (mounted) {
      setState(() => _cancellingOrderId = null);
    }
  }
}


  Widget _orderCard(Map<String, dynamic> order) {
    final items = order['items'] is List
        ? (order['items'] as List).whereType<Map>().toList()
        : <Map>[];

    final orderNumber =
        order['orderNumber']?.toString() ?? order['id']?.toString() ?? 'N/A';
    final status = order['status']?.toString() ?? 'pending';
    final paymentStatus =
        order['paymentStatus']?.toString() ?? 'pending';

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.receipt_long, size: 25),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Order number',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                      const SizedBox(height: 3),
                      SelectableText(
                        orderNumber,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Placed on ${_date(order['createdAt'])}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
                _statusChip(status),
              ],
            ),
            const Divider(height: 28),
            ...items.map((item) {
              final title =
                  item['productTitle']?.toString() ?? 'Product';
              final quantity = item['quantity'] ?? 1;
              final total = item['lineTotal'] ?? item['unitPrice'] ?? 0;

              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    const Icon(Icons.shopping_bag_outlined, size: 19),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '$title × $quantity',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _money(total),
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              );
            }),
            const Divider(height: 20),
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Total',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                Text(
                  _money(order['total']),
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 12),
            Row(
              children: [
                const Text(
                  'Payment: ',
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                ),
                _statusChip(paymentStatus),
              ],
            ),
            if (status.toLowerCase() == 'pending') ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _cancellingOrderId == null
                      ? () => _cancelOrder(order)
                      : null,
                  icon: _cancellingOrderId == order['id']?.toString()
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                          ),
                        )
                      : const Icon(Icons.cancel_outlined),
                  label: Text(
                    _cancellingOrderId == order['id']?.toString()
                        ? 'Cancelling...'
                        : 'Cancel order',
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Orders'),
        actions: [
          IconButton(
            tooltip: 'Refresh orders',
            onPressed: _loading ? null : _loadOrders,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.error_outline,
                          size: 48,
                          color: Colors.red,
                        ),
                        const SizedBox(height: 12),
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: _loadOrders,
                          child: const Text('Try again'),
                        ),
                      ],
                    ),
                  ),
                )
              : _orders.isEmpty
                  ? RefreshIndicator(
                      onRefresh: _loadOrders,
                      child: ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: const [
                          SizedBox(height: 130),
                          Icon(
                            Icons.receipt_long_outlined,
                            size: 70,
                            color: Colors.grey,
                          ),
                          SizedBox(height: 16),
                          Center(
                            child: Text(
                              'No orders yet',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          SizedBox(height: 8),
                          Center(
                            child: Text(
                              'Your orders will appear here after checkout.',
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadOrders,
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(16),
                        itemCount: _orders.length,
                        itemBuilder: (context, index) =>
                            _orderCard(_orders[index]),
                      ),
                    ),
    );
  }
}

