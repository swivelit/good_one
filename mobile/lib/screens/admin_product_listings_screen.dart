
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

// Uses the same API base URL as the rest of the app.
import '../main.dart' show apiUrl, secureStorage;

class AdminProductListingsScreen extends StatefulWidget {
  const AdminProductListingsScreen({super.key});

  @override
  State<AdminProductListingsScreen> createState() =>
      _AdminProductListingsScreenState();
}

class _AdminProductListingsScreenState
    extends State<AdminProductListingsScreen> {
  List<Map<String, dynamic>> products = [];
  bool isLoading = true;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    fetchProducts();
  }

  Future<void> fetchProducts() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final token = await secureStorage.read(key: 'auth_token');

      if (token == null || token.isEmpty) {
        throw Exception('Please log in again as an administrator.');
      }

      final response = await http
          .get(
            Uri.parse('$apiUrl/products/admin/all'),
            headers: {'Authorization': 'Bearer $token'},
          )
          .timeout(const Duration(seconds: 20));

      final data = jsonDecode(response.body) as Map<String, dynamic>;

      if (response.statusCode != 200 || data['success'] != true) {
        throw Exception(
          data['message'] ?? 'Unable to load product listings.',
        );
      }

      final rawProducts = data['products'] as List<dynamic>? ?? [];

      if (!mounted) return;

      setState(() {
        products = rawProducts.whereType<Map<String, dynamic>>().toList();
        isLoading = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        errorMessage = error.toString().replaceFirst('Exception: ', '');
        isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Product Listings'),
        actions: [
          IconButton(
            tooltip: 'Refresh listings',
            onPressed: isLoading ? null : fetchProducts,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: fetchProducts,
        child: isLoading
            ? ListView(
                children: const [
                  SizedBox(height: 280),
                  Center(child: CircularProgressIndicator()),
                ],
              )
            : errorMessage != null
                ? ListView(
                    padding: const EdgeInsets.all(24),
                    children: [
                      const Icon(
                        Icons.error_outline,
                        size: 48,
                        color: Colors.red,
                      ),
                      const SizedBox(height: 12),
                      Center(child: Text(errorMessage!)),
                      const SizedBox(height: 16),
                      Center(
                        child: FilledButton(
                          onPressed: fetchProducts,
                          child: const Text('Retry'),
                        ),
                      ),
                    ],
                  )
                : products.isEmpty
                    ? ListView(
                        children: const [
                          SizedBox(height: 180),
                          Icon(Icons.inventory_2_outlined, size: 48),
                          SizedBox(height: 12),
                          Center(child: Text('No product listings found.')),
                        ],
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: products.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final product = products[index];
                          final title =
                              product['title']?.toString() ?? 'Untitled';
                          final vendor =
                              product['vendorUser']?['name']?.toString() ??
                              product['vendor']?['businessName']?.toString() ??
                              'Unknown vendor';
                          final price = product['price'];
                          final isActive = product['isActive'] == true;
                          final expiresAt =
                              DateTime.tryParse(
                                product['expiresAt']?.toString() ?? '',
                              );

                          return Card(
                            child: ListTile(
                              leading: CircleAvatar(
                                child: Icon(
                                  isActive
                                      ? Icons.inventory_2_outlined
                                      : Icons.inventory_2,
                                ),
                              ),
                              title: Text(
                                title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Vendor: $vendor'),
                                  if (price != null) Text('Price: ₹$price'),
                                  Text(
                                    'Status: ${isActive ? 'Active' : 'Inactive'}',
                                  ),
                                  if (expiresAt != null)
                                    Text(
                                      'Expires: ${expiresAt.toLocal()}',
                                    ),
                                ],
                              ),
                              isThreeLine: true,
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
