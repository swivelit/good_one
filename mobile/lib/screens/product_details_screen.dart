
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'cart_screen.dart';
class ProductDetailsScreen extends StatefulWidget {
  final String productId;
  final String backendUrl;
  final CartController cart;

  const ProductDetailsScreen({
  super.key,
  required this.productId,
  required this.backendUrl,
  required this.cart,
});
  @override
  State<ProductDetailsScreen> createState() => _ProductDetailsScreenState();
}

class _ProductDetailsScreenState extends State<ProductDetailsScreen> {
  late Future<Map<String, dynamic>> _productFuture;

  @override
  void initState() {
    super.initState();
    _productFuture = _fetchProduct();
  }

  Future<Map<String, dynamic>> _fetchProduct() async {
    final response = await http.get(
      Uri.parse(
        '${widget.backendUrl}/api/products/${Uri.encodeComponent(widget.productId)}',
      ),
    );

    final decoded = jsonDecode(response.body);

    if (response.statusCode != 200 ||
        decoded is! Map<String, dynamic> ||
        decoded['success'] != true ||
        decoded['product'] is! Map<String, dynamic>) {
      final message = decoded is Map<String, dynamic>
          ? decoded['message']?.toString()
          : null;
      throw Exception(message ?? 'Unable to load product details.');
    }

    return Map<String, dynamic>.from(decoded['product'] as Map);
  }

  String _text(dynamic value, [String fallback = 'Not provided']) {
    if (value == null || value.toString().trim().isEmpty) {
      return fallback;
    }
    return value.toString();
  }

  String _price(dynamic value) {
    final amount = double.tryParse(value?.toString() ?? '');
    if (amount == null) return 'Price unavailable';
    return '₹${amount.toStringAsFixed(2)}';
  }

  String? _imageUrl(dynamic value) {
    if (value == null || value.toString().trim().isEmpty) return null;

    final path = value.toString();
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    return '${widget.backendUrl}/uploads/${path.replaceFirst(RegExp(r'^/+'), '')}';
  }

  Widget _detail(String label, dynamic value) {
    if (value == null || value.toString().trim().isEmpty) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 112,
            child: Text(
              label,
              style: const TextStyle(
                color: Colors.black54,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value.toString(),
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F7F7),
      appBar: AppBar(
        title: const Text('Product details'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _productFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError || !snapshot.hasData) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.inventory_2_outlined,
                      size: 52,
                      color: Colors.grey,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Could not load this product.',
                      style: TextStyle(fontSize: 17),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      snapshot.error?.toString().replaceFirst('Exception: ', '') ??
                          'Please try again.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () {
                        setState(() {
                          _productFuture = _fetchProduct();
                        });
                      },
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }

          final product = snapshot.data!;
          final vendor = product['vendor'] is Map
              ? Map<String, dynamic>.from(product['vendor'] as Map)
              : <String, dynamic>{};
          final vendorUser = product['vendorUser'] is Map
              ? Map<String, dynamic>.from(product['vendorUser'] as Map)
              : <String, dynamic>{};

          final rawImages = product['images'];
          final images = rawImages is List
              ? rawImages.map(_imageUrl).whereType<String>().toList()
              : <String>[];

          final description = _text(product['description'], '');
          final location = _text(
            product['location'] ?? product['city'],
            '',
          );
          final vendorName = _text(
            vendor['businessName'] ?? vendorUser['name'],
            'GoodOne seller',
          );

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              Container(
                height: 280,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                clipBehavior: Clip.antiAlias,
                child: images.isEmpty
                    ? const Center(
                        child: Icon(
                          Icons.image_outlined,
                          size: 72,
                          color: Colors.grey,
                        ),
                      )
                    : PageView.builder(
                        itemCount: images.length,
                        itemBuilder: (context, index) => Image.network(
                          images[index],
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Center(
                            child: Icon(
                              Icons.broken_image_outlined,
                              size: 56,
                              color: Colors.grey,
                            ),
                          ),
                        ),
                      ),
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _price(product['price']),
                      style: const TextStyle(
                        fontSize: 27,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF176B45),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      _text(product['title'] ?? product['name'], 'Untitled product'),
                      style: const TextStyle(
                        fontSize: 21,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        if (_text(product['category'], '') != '')
                          Chip(label: Text(_text(product['category']))),
                        if (_text(product['condition'], '') != '')
                          Chip(label: Text(_text(product['condition']))),
                      ],
                    ),
                    if (description.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      const Text(
                        'Description',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        description,
                        style: const TextStyle(height: 1.5),
                      ),
                    ],
                    const SizedBox(height: 20),
                    const Divider(),
                    const SizedBox(height: 12),
                    const Text(
                      'Product information',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 14),
                    _detail('Category', product['category']),
                    _detail('Condition', product['condition']),
                    _detail('Location', location),
                    _detail('Stock', product['quantity'] ?? product['stock']),
                    _detail('Seller', vendorName),
                    _detail('Business', vendor['businessName']),
                    _detail('Rating', vendor['rating']),
                  ],
                ),
              ),
              
const SizedBox(height: 16),
FilledButton.icon(
  onPressed: () {
    final price = double.tryParse(product['price']?.toString() ?? '');
    if (price == null || price < 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invalid product price.')),
      );
      return;
    }

    widget.cart.add(
      CartItem(
        productId: widget.productId,
        title: _text(product['title'] ?? product['name'], 'Untitled product'),
        price: price,
        imageUrl: images.isEmpty ? null : images.first,
      ),
    );

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Added to cart'),
        action: SnackBarAction(
          label: 'VIEW CART',
          onPressed: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => CartScreen(cart: widget.cart),
              ),
            );
          },
        ),
      ),
    );
  },
  icon: const Icon(Icons.shopping_cart_outlined),
  label: const Text('Add to Cart'),
  style: FilledButton.styleFrom(
    backgroundColor: const Color(0xFFFF6B35),
    foregroundColor: Colors.white,
    padding: const EdgeInsets.symmetric(vertical: 16),
  ),
),

            ],
          );
        },
      ),
    );
  }
}
