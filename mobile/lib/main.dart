
import 'dart:async';
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'screens/product_details_screen.dart';
import 'screens/admin_coupons_screen.dart';
import 'screens/cart_screen.dart';
import 'screens/admin_product_listings_screen.dart';
import 'screens/my_orders_screen.dart';
final CartController appCart = CartController();

void main() {
  runApp(const GoodOneApp());
}


const backendUrl = 'http://127.0.0.1:5000';
const apiUrl = '$backendUrl/api';
const secureStorage = FlutterSecureStorage();

const demoProducts = <Map<String, dynamic>>[
  {
    'title': 'iPhone 13 — 128GB',
    'category': 'Mobiles',
    'price': 24999,
    'description': 'Demo listing for UI testing.',
    'condition': 'Used',
    'images': [],
    'vendor': {'businessName': 'Demo Mobile Store'},
  },
  {
    'title': 'Wireless Headphones',
    'category': 'Electronics',
    'price': 1499,
    'description': 'Demo listing for UI testing.',
    'condition': 'New',
    'images': [],
    'vendor': {'businessName': 'Demo Electronics'},
  },
  {
    'title': 'Study Desk',
    'category': 'Furniture',
    'price': 2999,
    'description': 'Demo listing for UI testing.',
    'condition': 'Used',
    'images': [],
    'vendor': {'businessName': 'Demo Furniture Store'},
  },
  {
    'title': 'Engineering Textbooks',
    'category': 'Books',
    'price': 650,
    'description': 'Demo listing for UI testing.',
    'condition': 'Used',
    'images': [],
    'vendor': {'businessName': 'Demo Book Shop'},
  },
  {
    'title': 'Sports Shoes',
    'category': 'Sports',
    'price': 1199,
    'description': 'Demo listing for UI testing.',
    'condition': 'New',
    'images': [],
    'vendor': {'businessName': 'Demo Sports Store'},
  },
  {
    'title': 'Indoor Plant Set',
    'category': 'Home & Garden',
    'price': 499,
    'description': 'Demo listing for UI testing.',
    'condition': 'New',
    'images': [],
    'vendor': {'businessName': 'Demo Home Store'},
  },
];

const categories = [
  'All',
  'Electronics',
  'Mobiles',
  'Furniture',
  'Clothing',
  'Books',
  'Sports',
  'Home & Garden',
  'Vehicles',
  'Other',
];

const orange = Color(0xFFFF6B35);
const navy = Color(0xFF2C3E50);


class GoodOneApp extends StatefulWidget {
  const GoodOneApp({super.key});

  @override
  State<GoodOneApp> createState() => _GoodOneAppState();
}

class _GoodOneAppState extends State<GoodOneApp> {

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GoodOne',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: orange,
          primary: orange,
        ),
        scaffoldBackgroundColor: const Color(0xFFF8F8FA),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: navy,
          elevation: 0,
        ),
      ),
      home: WelcomeScreen(cart: appCart),
    );
  }
}


class MarketplaceHome extends StatefulWidget {
  final CartController cart;

  const MarketplaceHome({
    super.key,
    required this.cart,
  });


  @override
  State<MarketplaceHome> createState() => _MarketplaceHomeState();
}

class _MarketplaceHomeState extends State<MarketplaceHome> {
  final searchController = TextEditingController();

  List<Map<String, dynamic>> products = [];
  String selectedCategory = 'All';
  String searchText = '';
  bool loading = true;
  String? error;
  int requestId = 0;
  Timer? debounce;

  @override
  void initState() {
    super.initState();
    fetchProducts();
  }

  @override
  void dispose() {
    searchController.dispose();
    debounce?.cancel();
    super.dispose();
  }

  Future<void> fetchProducts() async {
    final currentRequest = ++requestId;

    setState(() {
      loading = true;
      error = null;
    });

    try {
      final query = <String, String>{
        'page': '1',
        'limit': '20',
      };

      if (selectedCategory != 'All') {
        query['category'] = selectedCategory;
      }

      if (searchText.trim().isNotEmpty) {
        query['search'] = searchText.trim();
      }

      final uri = Uri.parse('$apiUrl/products')
          .replace(queryParameters: query);

      final response = await http
          .get(uri)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('Server returned ${response.statusCode}');
      }

      final decoded = jsonDecode(response.body);
      final rawProducts = decoded is Map
          ? decoded['products']
          : null;

      if (rawProducts is! List) {
        throw const FormatException(
          'Unexpected product response from server',
        );
      }

      final loaded = rawProducts
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();

      
if (!mounted || currentRequest != requestId) return;


setState(() {
  products = loaded;
  loading = false;
  error = null;
});


    } catch (e) {
      if (!mounted || currentRequest != requestId) return;

      
setState(() {
  products = [];
  loading = false;
  error = 'Could not load products. Please try again.';
});

    }

  }

  void onSearchChanged(String value) {
    searchText = value;
    debounce?.cancel();
    debounce = Timer(
      const Duration(milliseconds: 500),
      fetchProducts,
    );
  }

  String imageUrl(Map<String, dynamic> product) {
    final images = product['images'];

    if (images is! List || images.isEmpty) return '';

    final value = images.first.toString().trim();

    if (value.isEmpty) return '';
    if (value.startsWith('https://') || value.startsWith('http://')) {
      return value;
    }

    final path = value
        .replaceFirst(RegExp(r'^/+'), '')
        .replaceFirst(RegExp(r'^uploads/+'), '');

    return '$backendUrl/uploads/$path';
  }

  String money(dynamic value) {
    final amount = value is num
        ? value
        : num.tryParse(value?.toString() ?? '') ?? 0;

    return '₹${amount.toStringAsFixed(0)}';
  }

  String timeLeft(dynamic value) {
    if (value == null) return 'Fresh listing';

    final expiry = DateTime.tryParse(value.toString());

    if (expiry == null) return 'Fresh listing';

    final difference = expiry.difference(DateTime.now());

    if (difference.isNegative) return 'Expired';

    if (difference.inHours < 1) {
      return '${difference.inMinutes}m left';
    }

    return '${difference.inHours}h left';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 20,
        title: const Row(
          children: [
            Icon(Icons.storefront_rounded, color: orange, size: 30),
            SizedBox(width: 8),
            Text(
              'GoodOne',
              style: TextStyle(
                color: navy,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.6,
              ),
            ),
          ],
        ),
        actions: [
 
IconButton(
  tooltip: 'My Orders',
  icon: const Icon(Icons.receipt_long_outlined),
  onPressed: () async {
    final token = await secureStorage.read(key: 'auth_token');

    if (!context.mounted) return;

    if (token == null || token.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please log in to view your orders.'),
        ),
      );
      return;
    }

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const MyOrdersScreen(),
      ),
    );
  },
),

IconButton(
  tooltip: 'Account',
  onPressed: () async {
    final token = await secureStorage.read(key: 'auth_token');

    if (!context.mounted) return;

    // Guests can still open the Welcome screen.
    if (token == null || token.isEmpty) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => WelcomeScreen(cart: appCart),
        ),
      );
      return;
    }

    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text(
          'Are you sure you want to log out of your GoodOne account?',
        ),
        actions: [
          TextButton(
            onPressed: () =>
                Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.of(dialogContext).pop(true),
            child: const Text('Log out'),
          ),
        ],
      ),
    );

    if (shouldLogout != true) return;

    await secureStorage.delete(key: 'auth_token');
    await secureStorage.delete(key: 'user_role');

    if (!context.mounted) return;

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => WelcomeScreen(cart: appCart),
      ),
      (route) => false,
    );
  },
  icon: const Icon(Icons.account_circle_outlined),
),

  const SizedBox(width: 8),
],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: fetchProducts,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 12, 18, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Buy & Sell',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                          color: navy,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Discover fresh listings from local vendors.',
                        style: TextStyle(color: Colors.black54),
                      ),
                      const SizedBox(height: 18),
                      TextField(
                        controller: searchController,
                        onChanged: onSearchChanged,
                        textInputAction: TextInputAction.search,
                        decoration: InputDecoration(
                          hintText: 'Search products...',
                          prefixIcon: const Icon(Icons.search_rounded),
                          suffixIcon: searchController.text.isEmpty
    ? null
    : IconButton(
        onPressed: () {
          searchController.clear();
          onSearchChanged('');
          setState(() {});
        },
        icon: const Icon(Icons.close),
      ),
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(15),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      const Text(
                        'Categories',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: navy,
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        height: 42,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: categories.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(width: 8),
                          itemBuilder: (context, index) {
                            final category = categories[index];
                            final selected =
                                category == selectedCategory;

                            return ChoiceChip(
                              label: Text(category),
                              selected: selected,
                              selectedColor: orange,
                              backgroundColor: Colors.white,
                              labelStyle: TextStyle(
                                color: selected
                                    ? Colors.white
                                    : navy,
                                fontWeight: FontWeight.w600,
                              ),
                              onSelected: (_) {
                                setState(() {
                                  selectedCategory = category;
                                });
                                fetchProducts();
                              },
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 22),
                      Row(
                        mainAxisAlignment:
                            MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Fresh listings',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: navy,
                            ),
                          ),
                          Text(
                            '${products.length} items',
                            style: const TextStyle(
                              color: Colors.black54,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                    ],
                  ),
                ),
              ),
              if (loading && products.isEmpty)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: CircularProgressIndicator(color: orange),
                  ),
                )
              else if (error != null && products.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.cloud_off_rounded,
                            size: 48,
                            color: Colors.black38,
                          ),
                          const SizedBox(height: 12),
                          Text(error!, textAlign: TextAlign.center),
                          const SizedBox(height: 12),
                          FilledButton(
                            onPressed: fetchProducts,
                            child: const Text('Try again'),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else if (products.isEmpty)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Text('No listings found. Try another search.'),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
                  sliver: SliverGrid(
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      mainAxisExtent: 286,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) =>
                          ProductCard(product: products[index], cart: widget.cart),
                      childCount: products.length,
                    ),
                  ),
                ),
              if (loading && products.isNotEmpty)
                const SliverToBoxAdapter(
                  child: LinearProgressIndicator(color: orange),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.product,
    required this.cart,
  });

  final Map<String, dynamic> product;
  final CartController cart;

  @override
  Widget build(BuildContext context) {
    final images = product['images'];
    String url = '';

    if (images is List && images.isNotEmpty) {
      final first = images.first.toString().trim();

      if (first.startsWith('http://') || first.startsWith('https://')) {
        url = first;
      } else if (first.isNotEmpty) {
        final path = first
            .replaceFirst(RegExp(r'^/+'), '')
            .replaceFirst(RegExp(r'^uploads/+'), '');
        url = '$backendUrl/uploads/$path';
      }
    }

    final title = product['title']?.toString() ?? 'Untitled listing';
    final vendorUser = product['vendorUser'];
    final vendor = product['vendor'];

    final seller = vendor is Map
        ? vendor['businessName']?.toString()
        : null;

    final userName = vendorUser is Map
        ? vendorUser['name']?.toString()
        : null;

    final expiry = DateTime.tryParse(
      product['expiresAt']?.toString() ?? '',
    );

    String remaining = 'Fresh listing';

    if (expiry != null) {
      final duration = expiry.difference(DateTime.now());
      remaining = duration.isNegative
          ? 'Expired'
          : duration.inHours < 1
              ? '${duration.inMinutes}m left'
              : '${duration.inHours}h left';
    }

    return Card(
      clipBehavior: Clip.antiAlias,
      elevation: 1,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(15),
      ),
      child: InkWell(
        onTap: () {
  final productId = product['id']?.toString();

  if (productId == null || productId.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Product ID is unavailable.'),
      ),
    );
    return;
  }

  Navigator.of(context).push(
    MaterialPageRoute(
      builder: (_) => ProductDetailsScreen(
        productId: productId,
        backendUrl: backendUrl,
        cart: cart,
      ),
    ),
  );
},
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                SizedBox(
                  height: 132,
                  width: double.infinity,
                  child: url.isEmpty
                      ? const ColoredBox(
                          color: Color(0xFFF0F0F0),
                          child: Icon(
                            Icons.image_outlined,
                            size: 42,
                            color: Colors.black38,
                          ),
                        )
                      : Image.network(
                          url,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              const ColoredBox(
                            color: Color(0xFFF0F0F0),
                            child: Icon(
                              Icons.broken_image_outlined,
                              size: 42,
                              color: Colors.black38,
                            ),
                          ),
                        ),
                ),
                Positioned(
                  top: 8,
                  right: 7,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.95),
                      borderRadius: BorderRadius.circular(7),
                    ),
                    child: Text(
                      remaining,
                      style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product['category']?.toString() ?? 'Other',
                      style: const TextStyle(
                        fontSize: 10,
                        color: orange,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: navy,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '₹${(product['price'] as num?)?.toStringAsFixed(0) ?? product['price'] ?? '—'}',
                      style: const TextStyle(
                        color: orange,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Row(
                      children: [
                        const Icon(
                          Icons.storefront_outlined,
                          size: 13,
                          color: Colors.black45,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            seller ?? userName ?? 'Registered vendor',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 10,
                              color: Colors.black54,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class WelcomeScreen extends StatelessWidget {
  final CartController cart;

  const WelcomeScreen({
    super.key,
    required this.cart,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(flex: 2),
              const Icon(
                Icons.storefront_rounded,
                color: orange,
                size: 78,
              ),
              const SizedBox(height: 12),
              const Text(
                'GoodOne',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: navy,
                  fontSize: 34,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Buy and sell locally, all in one place.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black54, fontSize: 15),
              ),
              const Spacer(flex: 2),
              FilledButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => AuthScreen(isLogin: true, cart: cart)
                    ),
                  );
                },
                style: FilledButton.styleFrom(
                  backgroundColor: orange,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: const Text('Log in'),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => AuthScreen(isLogin: false, cart: cart),
                    ),
                  );
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: navy,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  side: const BorderSide(color: orange),
                ),
                child: const Text('Sign up'),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () {
                  Navigator.of(context).pushReplacement(
                    MaterialPageRoute(
                      builder: (_) => MarketplaceHome(cart: cart),
                    ),
                  );
                },
                child: const Text(
                  'Browse as guest',
                  style: TextStyle(color: navy),
                ),
              ),
              const Spacer(),
              const Text(
                'Your local marketplace',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black38, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({
    super.key,
    required this.isLogin,
    required this.cart,
  });

  final bool isLogin;
  final CartController cart;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final formKey = GlobalKey<FormState>();
  final nameController = TextEditingController();
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  final otpController = TextEditingController();
  final phoneController = TextEditingController();
  final businessNameController = TextEditingController();
  final businessDescriptionController = TextEditingController();
  final businessAddressController = TextEditingController();
  bool otpSent = false;

  String role = 'Buyer';
  bool hidePassword = true;
  bool isLoading = false;
  
  @override
  void dispose() {
    nameController.dispose();
    emailController.dispose();
    passwordController.dispose();
    super.dispose();
    otpController.dispose();
    phoneController.dispose();
    businessNameController.dispose();
    businessDescriptionController.dispose();
    businessAddressController.dispose();
  }

Future<void> sendOtp() async {
  if (!formKey.currentState!.validate()) return;

  final email = emailController.text.trim().toLowerCase();

  setState(() => isLoading = true);

  try {
    final response = await http
        .post(
          Uri.parse('$apiUrl/sendOtp'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'email': email}),
        )
        .timeout(const Duration(seconds: 20));

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode != 200 || data['success'] != true) {
      throw Exception(data['message'] ?? 'Could not send OTP');
    }

    if (!mounted) return;

    setState(() => otpSent = true);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(data['message'] ?? 'OTP sent successfully')),
    );
  } catch (error) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          error.toString().replaceFirst('Exception: ', ''),
        ),
      ),
    );
  } finally {
    if (mounted) setState(() => isLoading = false);
  }
}
 
Future<void> registerCustomer() async {
  if (!formKey.currentState!.validate()) return;
  
if (otpController.text.trim().length != 6) {
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(
      content: Text('Please enter the 6-digit OTP sent to your email.'),
    ),
  );
  return;
}

  if (!otpSent) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Please request an OTP first.')),
    );
    return;
  }

  setState(() => isLoading = true);

  try {
    final response = await http
        .post(
          Uri.parse('$apiUrl/auth/register/customer'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'name': nameController.text.trim(),
            'email': emailController.text.trim().toLowerCase(),
            'password': passwordController.text,
            'otp': otpController.text.trim(),
          }),
        )
        .timeout(const Duration(seconds: 20));

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode != 201 || data['success'] != true) {
      throw Exception(data['message'] ?? 'Registration failed');
    }

    final token = data['token'] as String?;
    final user = data['user'] as Map<String, dynamic>?;

    if (token == null || user == null) {
      throw Exception('Account created, but the server response was incomplete.');
    }

    await secureStorage.write(key: 'auth_token', value: token);
    await secureStorage.write(
      key: 'user_role',
      value: (user['role'] ?? 'customer').toString().toLowerCase(),
    );

    if (!mounted) return;

    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => MarketplaceHome(cart: widget.cart)),
    );
  } catch (error) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          error.toString().replaceFirst('Exception: ', ''),
        ),
      ),
    );
  } finally {
    if (mounted) setState(() => isLoading = false);
  }
}

Future<void> registerVendor() async {
  if (!formKey.currentState!.validate()) return;

  if (!otpSent) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Please request an OTP first.')),
    );
    return;
  }

  if (otpController.text.trim().length != 6) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Please enter the 6-digit OTP.')),
    );
    return;
  }

  setState(() => isLoading = true);

  try {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$apiUrl/auth/register/vendor'),
    );

    request.fields.addAll({
      'name': nameController.text.trim(),
      'email': emailController.text.trim().toLowerCase(),
      'phone': phoneController.text.trim(),
      'password': passwordController.text,
      'otp': otpController.text.trim(),
      'businessName': businessNameController.text.trim(),
      'businessDescription': businessDescriptionController.text.trim(),
      'businessAddress': businessAddressController.text.trim(),
    });

    final streamedResponse =
        await request.send().timeout(const Duration(seconds: 30));
    final response = await http.Response.fromStream(streamedResponse);
    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode != 201 || data['success'] != true) {
      throw Exception(data['message'] ?? 'Vendor registration failed');
    }

    final token = data['token'] as String?;
    final user = data['user'] as Map<String, dynamic>?;

    if (token == null || user == null) {
      throw Exception(
        'Account created, but the server response was incomplete.',
      );
    }

    await secureStorage.write(key: 'auth_token', value: token);
    await secureStorage.write(
      key: 'user_role',
      value: (user['role'] ?? 'vendor').toString().toLowerCase(),
    );

    if (!mounted) return;

    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => const VendorDashboardScreen(),
      ),
    );
  } catch (error) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          error.toString().replaceFirst('Exception: ', ''),
        ),
      ),
    );
  } finally {
    if (mounted) setState(() => isLoading = false);
  }
}

Future<void> login() async {
  if (!formKey.currentState!.validate()) return;

  setState(() => isLoading = true);

  try {
    final response = await http
        .post(
          Uri.parse('$apiUrl/auth/login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'emailOrPhone': emailController.text.trim(),
            'password': passwordController.text,
          }),
        )
        .timeout(const Duration(seconds: 20));

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode != 200 || data['success'] != true) {
      throw Exception(data['message'] ?? 'Login failed');
    }

    final token = data['token'] as String?;
    final user = data['user'] as Map<String, dynamic>?;

    if (token == null || user == null) {
      throw Exception('Invalid response from server');
    }

    await secureStorage.write(key: 'auth_token', value: token);
    await secureStorage.write(
      key: 'user_role',
      value: (user['role'] ?? '').toString().toLowerCase(),
    );

    if (!mounted) return;

    final userRole = (user['role'] ?? '').toString().toLowerCase();

    
if (userRole == 'admin') {
  Navigator.pushReplacement(
    context,
    MaterialPageRoute(
      builder: (_) => const AdminDashboardScreen(),
    ),
  );
  return;
}


    if (userRole == 'vendor') {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => const VendorDashboardScreen(),
        ),
      );
    } else if (userRole == 'customer') {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => MarketplaceHome(cart: widget.cart),
        ),
      );
    } else {
      throw Exception('Unsupported account role');
    }
  } catch (error) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(error.toString().replaceFirst('Exception: ', ''))),
    );
  } finally {
    if (mounted) setState(() => isLoading = false);
  }
}


  @override
  Widget build(BuildContext context) {
    final isLogin = widget.isLogin;

    return Scaffold(
      appBar: AppBar(title: Text(isLogin ? 'Log in' : 'Create account')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  isLogin ? 'Welcome back!' : 'Join GoodOne',
                  style: const TextStyle(
                    color: navy,
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  isLogin
                      ? 'Log in to continue to your account.'
                      : 'Create an account to buy or sell locally.',
                  style: const TextStyle(color: Colors.black54),
                ),
                const SizedBox(height: 24),
                if (!isLogin) ...[
                  const Text(
                    'I want to join as',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 10),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(
                        value: 'Buyer',
                        label: Text('Buyer'),
                        icon: Icon(Icons.person_outline),
                      ),
                      ButtonSegment(
                        value: 'Vendor',
                        label: Text('Vendor'),
                        icon: Icon(Icons.storefront_outlined),
                      ),
                    ],
                    selected: {role},
                    onSelectionChanged: (selection) {
                      setState(() => role = selection.first);
                    },
                  ),
                  const SizedBox(height: 18),
                  TextFormField(
                    controller: nameController,
                    decoration: const InputDecoration(
                      labelText: 'Full name',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                    validator: (value) {
                      if (!isLogin && (value == null || value.trim().isEmpty)) {
                        return 'Enter your name';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                ],
                TextFormField(
                  controller: emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email address',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                  validator: (value) {
                    if (value == null ||
                        !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
                            .hasMatch(value.trim())) {
                      return 'Enter a valid email address';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: passwordController,
                  obscureText: hidePassword,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      onPressed: () =>
                          setState(() => hidePassword = !hidePassword),
                      icon: Icon(
                        hidePassword
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                      ),
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.length < 6) {
                      return 'Password must be at least 6 characters';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),
               
if (!isLogin && role == 'Vendor') ...[
  TextFormField(
    controller: phoneController,
    keyboardType: TextInputType.phone,
    decoration: const InputDecoration(
      labelText: 'Phone number',
      prefixIcon: Icon(Icons.phone_outlined),
      border: OutlineInputBorder(),
    ),
    validator: (value) {
      if (value == null || value.trim().isEmpty) {
        return 'Enter your phone number';
      }
      return null;
    },
  ),
  const SizedBox(height: 16),
  TextFormField(
    controller: businessNameController,
    decoration: const InputDecoration(
      labelText: 'Business name',
      prefixIcon: Icon(Icons.storefront_outlined),
      border: OutlineInputBorder(),
    ),
    validator: (value) {
      if (value == null || value.trim().isEmpty) {
        return 'Enter your business name';
      }
      return null;
    },
  ),
  const SizedBox(height: 16),
  TextFormField(
    controller: businessDescriptionController,
    decoration: const InputDecoration(
      labelText: 'Business description (optional)',
      prefixIcon: Icon(Icons.description_outlined),
      border: OutlineInputBorder(),
    ),
  ),
  const SizedBox(height: 16),
  TextFormField(
    controller: businessAddressController,
    decoration: const InputDecoration(
      labelText: 'Business address (optional)',
      prefixIcon: Icon(Icons.location_on_outlined),
      border: OutlineInputBorder(),
    ),
  ),
  const SizedBox(height: 24),
],
 
if (!isLogin) ...[
  Row(
    children: [
      Expanded(
        child: TextFormField(
          controller: otpController,
          keyboardType: TextInputType.number,
          maxLength: 6,
          decoration: const InputDecoration(
            labelText: 'Email OTP',
            counterText: '',
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.verified_user_outlined),
          ),
          validator: (value) {
  if (value != null &&
      value.trim().isNotEmpty &&
      value.trim().length != 6) {
    return 'Enter the 6-digit OTP';
  }
  return null;
},
        ),
      ),
      const SizedBox(width: 8),
      OutlinedButton(
        onPressed: isLoading ? null : sendOtp,
        child: const Text('Send OTP'),
      ),
    ],
  ),
  const SizedBox(height: 24),
],

                FilledButton(
                  
onPressed: isLoading
    ? null
    : () {
        
if (widget.isLogin) {
  login();
} else if (role == 'Buyer') {
  registerCustomer();
} else {
  registerVendor();
}

      },

                  style: FilledButton.styleFrom(
                    backgroundColor: orange,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                 child: isLoading
    ? const SizedBox(
        height: 20,
        width: 20,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: Colors.white,
        ),
      )
    : Text(widget.isLogin ? 'Log in' : 'Create account'),),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(
                    isLogin
                        ? 'New to GoodOne? Sign up'
                        : 'Already have an account? Log in',
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class VendorDashboardScreen extends StatelessWidget {
  const VendorDashboardScreen({super.key});

  Future<void> _logout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text(
          'Are you sure you want to log out of your vendor account?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Log out'),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;

    await secureStorage.delete(key: 'auth_token');
    await secureStorage.delete(key: 'user_role');

    if (!context.mounted) return;

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => WelcomeScreen(cart: appCart)),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Vendor Dashboard',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            tooltip: 'Log out',
            icon: const Icon(Icons.logout),
            onPressed: () => _logout(context),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: navy,
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.storefront_rounded,
                  color: Colors.white,
                  size: 36,
                ),
                SizedBox(height: 16),
                Text(
                  'Grow your business with GoodOne',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(height: 8),
                Text(
                  'Create listings and manage your products in one place.',
                  style: TextStyle(color: Colors.white70),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          const Text(
            'Manage your store',
            style: TextStyle(
              color: navy,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 14),
          _DashboardAction(
            icon: Icons.add_box_outlined,
            title: 'Add Product',
            subtitle: 'Create a new product listing',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const AddProductScreen(),
                ),
              );
            },
          ),
          const SizedBox(height: 12),
          _DashboardAction(
            icon: Icons.inventory_2_outlined,
            title: 'My Listings',
            subtitle: 'View and manage your products',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const MyListingsScreen(),
                ),
              );
            },
          ),
          
         
        ],
      ),
    );
  }
}

class _DashboardAction extends StatelessWidget {
  const _DashboardAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.white,
      elevation: 1,
      child: ListTile(
        contentPadding: const EdgeInsets.all(14),
        leading: CircleAvatar(
          backgroundColor: orange.withValues(alpha: 0.12),
          child: Icon(icon, color: orange),
        ),
        title: Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            color: navy,
          ),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(subtitle),
        ),
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: onTap,
      ),
    );
  }
}


class AddProductScreen extends StatefulWidget {
  final Map<String, dynamic>? product;

  const AddProductScreen({
    super.key,
    this.product,
  });

  bool get isEditing => product != null;

  @override
  State<AddProductScreen> createState() => _AddProductScreenState();
}


class _AddProductScreenState extends State<AddProductScreen> {
  final formKey = GlobalKey<FormState>();
  final titleController = TextEditingController();
  final descriptionController = TextEditingController();
  final priceController = TextEditingController();
  final originalPriceController = TextEditingController();
  final locationController = TextEditingController();
  final tagsController = TextEditingController();

  final picker = ImagePicker();

  String category = 'Electronics';
  String condition = 'Used';
  int durationHours = 24;
  List<XFile> images = [];
  bool isLoading = false;

  final categories = const [
    'Electronics',
    'Vehicles',
    'Fashion',
    'Home & Furniture',
    'Books',
    'Sports',
    'Other',
  ];

  final conditions = const ['New', 'Like New', 'Used', 'Refurbished'];
  
@override
void initState() {
  super.initState();

  final product = widget.product;
  if (product == null) return;

  titleController.text = product['title']?.toString() ?? '';
  descriptionController.text =
      product['description']?.toString() ?? '';
  priceController.text = product['price']?.toString() ?? '';
  originalPriceController.text =
      product['originalPrice']?.toString() ?? '';
  locationController.text = product['location']?.toString() ?? '';

  final tags = product['tags'];
  tagsController.text = tags is List
      ? tags.join(', ')
      : tags?.toString() ?? '';

  final existingCategory = product['category']?.toString();
  if (existingCategory != null &&
      categories.contains(existingCategory)) {
    category = existingCategory;
  }

  final existingCondition = product['condition']?.toString();
  if (existingCondition != null &&
      conditions.contains(existingCondition)) {
    condition = existingCondition;
  }

  final existingDuration = int.tryParse(
    product['durationHours']?.toString() ?? '',
  );

  if (existingDuration != null &&
      [12, 24, 48, 72, 168].contains(existingDuration)) {
    durationHours = existingDuration;
  }
}

  @override
  void dispose() {
    titleController.dispose();
    descriptionController.dispose();
    priceController.dispose();
    originalPriceController.dispose();
    locationController.dispose();
    tagsController.dispose();
    super.dispose();
  }

  Future<void> pickImages() async {
    try {
      final selected = await picker.pickMultiImage();
      if (!mounted) return;

      setState(() {
        images = selected.take(5).toList();
      });

      if (selected.length > 5) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Only the first 5 images were selected.')),
        );
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not select images: $error')),
      );
    }
  }

Future<void> createListing() async {
  if (!formKey.currentState!.validate()) return;

  final token = await secureStorage.read(key: 'auth_token');
  if (!mounted) return;

  if (token == null || token.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Please log in as a vendor first.')),
    );
    return;
  }

  final existingProduct = widget.product;
  final isEditing = widget.isEditing;

  setState(() => isLoading = true);

  try {
    final fields = <String, dynamic>{
      'title': titleController.text.trim(),
      'description': descriptionController.text.trim(),
      'price': priceController.text.trim(),
      'category': category,
      'condition': condition,
      'location': locationController.text.trim(),
      'durationHours': durationHours.toString(),
      'originalPrice': originalPriceController.text.trim(),
      'tags': tagsController.text.trim(),
    };

    final response = isEditing
        ? await http
            .put(
              Uri.parse('$apiUrl/products/${existingProduct!['id']}'),
              headers: {
                'Authorization': 'Bearer $token',
                'Content-Type': 'application/json',
              },
              body: jsonEncode(fields),
            )
            .timeout(const Duration(seconds: 30))
        : await _createProductRequest(token, fields);

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode != (isEditing ? 200 : 201) ||
        data['success'] != true) {
      throw Exception(
        data['message'] ??
            (isEditing
                ? 'Could not update listing.'
                : 'Could not create listing.'),
      );
    }

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          isEditing
              ? 'Listing updated successfully!'
              : 'Product listing created successfully!',
        ),
      ),
    );

    Navigator.of(context).pop(true);
  } catch (error) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          error.toString().replaceFirst('Exception: ', ''),
        ),
      ),
    );
  } finally {
    if (mounted) setState(() => isLoading = false);
  }
}

Future<http.Response> _createProductRequest(
  String token,
  Map<String, dynamic> fields,
) async {
  final request = http.MultipartRequest(
    'POST',
    Uri.parse('$apiUrl/products'),
  );

  request.headers['Authorization'] = 'Bearer $token';

  for (final entry in fields.entries) {
    if (entry.key == 'originalPrice' && entry.value.isEmpty) continue;
    if (entry.key == 'tags' && entry.value.isEmpty) continue;
    request.fields[entry.key] = entry.value.toString();
  }

  for (final image in images) {
    request.files.add(
      await http.MultipartFile.fromPath('images', image.path),
    );
  }

  final streamed = await request.send().timeout(
    const Duration(seconds: 60),
  );

  return http.Response.fromStream(streamed);
}

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
  title: Text(widget.isEditing ? 'Edit Product' : 'Add Product'),
),
      body: Form(
        key: formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            TextFormField(
              controller: titleController,
              decoration: const InputDecoration(
                labelText: 'Product title *',
                border: OutlineInputBorder(),
              ),
              validator: (value) =>
                  value == null || value.trim().isEmpty
                      ? 'Enter a product title'
                      : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: descriptionController,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Description *',
                border: OutlineInputBorder(),
              ),
              validator: (value) =>
                  value == null || value.trim().isEmpty
                      ? 'Enter a description'
                      : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: priceController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Price (₹) *',
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                final price = double.tryParse(value?.trim() ?? '');
                if (price == null || !price.isFinite || price < 0) {
                  return 'Enter a valid non-negative price';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: originalPriceController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Original price (optional)',
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) return null;
                final price = double.tryParse(value.trim());
                if (price == null || !price.isFinite || price < 0) {
                  return 'Enter a valid non-negative price';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
               initialValue: category,
              decoration: const InputDecoration(
                labelText: 'Category',
                border: OutlineInputBorder(),
              ),
              items: categories
                  .map((item) => DropdownMenuItem(
                        value: item,
                        child: Text(item),
                      ))
                  .toList(),
              onChanged: (value) {
                if (value != null) setState(() => category = value);
              },
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              initialValue: condition,
              decoration: const InputDecoration(
                labelText: 'Condition',
                border: OutlineInputBorder(),
              ),
              items: conditions
                  .map((item) => DropdownMenuItem(
                        value: item,
                        child: Text(item),
                      ))
                  .toList(),
              onChanged: (value) {
                if (value != null) setState(() => condition = value);
              },
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: locationController,
              decoration: const InputDecoration(
                labelText: 'Location',
                hintText: 'e.g. Shoranur, Kerala',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<int>(
              initialValue: durationHours,
              decoration: const InputDecoration(
                labelText: 'Listing duration',
                border: OutlineInputBorder(),
              ),
              items: const [12, 24, 48, 72, 168]
                  .map((hours) => DropdownMenuItem(
                        value: hours,
                        child: Text(
                          hours == 168 ? '7 days' : '$hours hours',
                        ),
                      ))
                  .toList(),
              onChanged: (value) {
                if (value != null) setState(() => durationHours = value);
              },
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: tagsController,
              decoration: const InputDecoration(
                labelText: 'Tags (optional)',
                hintText: 'car, sedan, automatic',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 18),
            OutlinedButton.icon(
              onPressed: isLoading ? null : pickImages,
              icon: const Icon(Icons.add_photo_alternate_outlined),
              label: Text('Select product images (${images.length}/5)'),
            ),
            if (images.isNotEmpty) ...[
              const SizedBox(height: 8),
              ...images.map(
                (image) => ListTile(
                  leading: const Icon(Icons.image_outlined),
                  title: Text(
                    image.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: IconButton(
                    tooltip: 'Remove image',
                    icon: const Icon(Icons.close),
                    onPressed: isLoading
                        ? null
                        : () => setState(() => images.remove(image)),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: isLoading ? null : createListing,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: isLoading
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(widget.isEditing ? 'Save Changes' : 'Create Listing'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}


class MyListingsScreen extends StatefulWidget {
  const MyListingsScreen({super.key});

  @override
  State<MyListingsScreen> createState() => _MyListingsScreenState();
}

class _MyListingsScreenState extends State<MyListingsScreen> {
  List<dynamic> listings = [];
  bool isLoading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    fetchListings();
  }

  Future<void> fetchListings() async {
    setState(() {
      isLoading = true;
      error = null;
    });

    try {
      final token = await secureStorage.read(key: 'auth_token');

      if (token == null || token.isEmpty) {
        throw Exception('Please log in again to view your listings.');
      }

      final response = await http
          .get(
            Uri.parse('$apiUrl/products/my-products'),
            headers: {
              'Authorization': 'Bearer $token',
              'Content-Type': 'application/json',
            },
          )
          .timeout(const Duration(seconds: 20));

      if (response.statusCode != 200) {
        throw Exception('Could not load listings. Please try again.');
      }

      final data = jsonDecode(response.body);

      if (data['success'] != true) {
        throw Exception(data['message'] ?? 'Could not load listings.');
      }

      if (!mounted) return;

      setState(() {
        listings = List<dynamic>.from(data['products'] ?? []);
        isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        error = e.toString().replaceFirst('Exception: ', '');
        isLoading = false;
      });
    }
  }
Future<void> toggleListingStatus(
  Map<String, dynamic> product,
  bool newStatus,
) async {
  final productId = product['id']?.toString();

  if (productId == null || productId.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Invalid product ID.')),
    );
    return;
  }

  try {
    final token = await secureStorage.read(key: 'auth_token');

    if (token == null || token.isEmpty) {
      throw Exception('Please log in again.');
    }

    final response = await http
        .put(
          Uri.parse('$apiUrl/products/$productId'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({'isActive': newStatus}),
        )
        .timeout(const Duration(seconds: 20));

    final data = jsonDecode(response.body);

    if (response.statusCode != 200 || data['success'] != true) {
      throw Exception(data['message'] ?? 'Could not update listing status.');
    }

    if (!mounted) return;

    setState(() {
      final index = listings.indexWhere(
        (item) => item['id']?.toString() == productId,
      );

      if (index != -1) {
        listings[index]['isActive'] = newStatus;
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          newStatus
              ? 'Listing is now visible to buyers.'
              : 'Listing is now hidden from buyers.',
        ),
      ),
    );
  } catch (e) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          e.toString().replaceFirst('Exception: ', ''),
        ),
      ),
    );
  }
}

Future<void> deleteListing(Map<String, dynamic> product) async {
  final productId = product['id']?.toString();

  if (productId == null || productId.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Invalid product ID.')),
    );
    return;
  }

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: const Text('Delete listing?'),
      content: Text(
        'Are you sure you want to permanently delete '
        '"${product['title'] ?? 'this product'}"? '
        'This action cannot be undone.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, false),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, true),
          style: TextButton.styleFrom(
            foregroundColor: Colors.red,
          ),
          child: const Text('Delete'),
        ),
      ],
    ),
  );

  if (confirmed != true || !mounted) return;

  try {
    final token = await secureStorage.read(key: 'auth_token');

    if (token == null || token.isEmpty) {
      throw Exception('Please log in again.');
    }

    final response = await http
        .delete(
          Uri.parse('$apiUrl/products/$productId'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
        )
        .timeout(const Duration(seconds: 20));

    final data = jsonDecode(response.body);

    if (response.statusCode != 200 || data['success'] != true) {
      throw Exception(data['message'] ?? 'Could not delete listing.');
    }

    if (!mounted) return;

    setState(() {
      listings.removeWhere(
        (item) => item['id']?.toString() == productId,
      );
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Listing deleted successfully.')),
    );
  } catch (e) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          e.toString().replaceFirst('Exception: ', ''),
        ),
      ),
    );
  }
}

  String formatPrice(dynamic price) {
    final value = double.tryParse(price.toString());
    if (value == null) return '₹$price';

    return '₹${value.toStringAsFixed(
      value == value.roundToDouble() ? 0 : 2,
    )}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Listings'),
        actions: [
          IconButton(
            onPressed: isLoading ? null : fetchListings,
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh listings',
          ),
        ],
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, size: 48),
                        const SizedBox(height: 12),
                        Text(error!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: fetchListings,
                          child: const Text('Try again'),
                        ),
                      ],
                    ),
                  ),
                )
              : listings.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.inventory_2_outlined,
                              size: 56,
                            ),
                            const SizedBox(height: 12),
                            const Text(
                              'No listings yet',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Your products will appear here '
                              'after you create a listing.',
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 16),
                            OutlinedButton.icon(
                              onPressed: fetchListings,
                              icon: const Icon(Icons.refresh),
                              label: const Text('Refresh'),
                            ),
                          ],
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: fetchListings,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: listings.length,
                        itemBuilder: (context, index) {
                          final product = listings[index]
                              as Map<String, dynamic>;

                          final images = product['images'] is List
                              ? List<dynamic>.from(product['images'])
                              : <dynamic>[];

                          final imageName = images.isNotEmpty
                              ? images.first.toString()
                              : '';

                          final imageUrl = imageName.isNotEmpty
                              ? '$backendUrl/uploads/$imageName'
                              : null;

                          final isActive = product['isActive'] == true;
                          final expiry = product['expiresAt']?.toString();

                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            clipBehavior: Clip.antiAlias,
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: imageUrl == null
                                        ? Container(
                                            width: 90,
                                            height: 90,
                                            color: Colors.grey.shade200,
                                            child: const Icon(
                                              Icons.image_outlined,
                                              size: 36,
                                            ),
                                          )
                                        : Image.network(
                                            imageUrl,
                                            width: 90,
                                            height: 90,
                                            fit: BoxFit.cover,
                                            errorBuilder: (
                                              context,
                                              error,
                                              stackTrace,
                                            ) {
                                              return Container(
                                                width: 90,
                                                height: 90,
                                                color: Colors.grey.shade200,
                                                child: const Icon(
                                                  Icons.broken_image_outlined,
                                                  size: 36,
                                                ),
                                              );
                                            },
                                          ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          product['title']?.toString() ??
                                              'Untitled product',
                                          style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          formatPrice(product['price'] ?? 0),
                                          style: TextStyle(
                                            fontSize: 16,
                                            color: Theme.of(context)
                                                .colorScheme
                                                .primary,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          '${product['category'] ?? 'Other'}'
                                          ' • '
                                          '${product['condition'] ?? 'Used'}',
                                        ),
                                        const SizedBox(height: 6),
                                        
Row(
  crossAxisAlignment: CrossAxisAlignment.center,
  children: [
    Expanded(
      child: Text(
        isActive ? 'Active' : 'Inactive',
        style: TextStyle(
          color: isActive ? Colors.green : Colors.red,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    Switch(
      value: isActive,
      onChanged: (newStatus) {
        toggleListingStatus(product, newStatus);
      },
    ),
  ],
),

Align(
  alignment: Alignment.centerRight,
  child: Wrap(
    spacing: 8,
    children: [
      
TextButton.icon(
  onPressed: () async {
    final updated = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => AddProductScreen(product: product),
      ),
    );

    if (updated == true && mounted) {
      await fetchListings();
    }
  },
  icon: const Icon(Icons.edit_outlined, size: 18),
  label: const Text('Edit'),
),

      TextButton.icon(
        onPressed: () => deleteListing(product),
        icon: const Icon(Icons.delete_outline, size: 18),
        label: const Text('Delete'),
        style: TextButton.styleFrom(
          foregroundColor: Colors.red,
        ),
      ),
    ],
  ),
),


                                        if (expiry != null &&
                                            expiry.isNotEmpty)
                                          Text(
                                            'Expires: '
                                            '${expiry.split('T').first}',
                                            style: const TextStyle(
                                              fontSize: 12,
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
class AdminDashboardScreen extends StatelessWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'GoodOne Admin',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            tooltip: 'Log out',
            icon: const Icon(Icons.logout),
           
onPressed: () async {
  final shouldLogout = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: const Text('Log out?'),
      content: const Text(
        'Are you sure you want to log out of your GoodOne account?',
      ),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.of(dialogContext).pop(false);
          },
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () {
            Navigator.of(dialogContext).pop(true);
          },
          child: const Text('Log out'),
        ),
      ],
    ),
  );

  if (shouldLogout != true) return;

  await secureStorage.delete(key: 'auth_token');
  await secureStorage.delete(key: 'user_role');

  if (!context.mounted) return;

  Navigator.of(context).pushAndRemoveUntil(
    MaterialPageRoute(
      builder: (_) => WelcomeScreen(cart: appCart),
    ),
    (route) => false,
  );
},

          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: navy,
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.admin_panel_settings,
                  color: Colors.white,
                  size: 38,
                ),
                SizedBox(height: 14),
                Text(
                  'Administrator Dashboard',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 23,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(height: 8),
                Text(
                  'Manage the GoodOne marketplace from one place.',
                  style: TextStyle(color: Colors.white70),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'Management',
            style: TextStyle(
              color: navy,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          
          _DashboardAction(
            icon: Icons.people_outline,
            title: 'Users & Vendors',
            subtitle: 'Manage marketplace accounts',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const AdminUsersScreen(),
                ),
              );
            },
          ),
          
          const SizedBox(height: 12),
          _DashboardAction(
            icon: Icons.inventory_2_outlined,
            title: 'Product Listings',
            subtitle: 'Review marketplace listings',
           onTap: () {
  Navigator.of(context).push(
    MaterialPageRoute(
      builder: (_) => const AdminProductListingsScreen(),
    ),
  );
},
          ),
        
          
          const SizedBox(height: 12),
          _DashboardAction(
            icon: Icons.confirmation_number_outlined,
            title: 'Coupons',
            subtitle: 'Create and manage discount codes',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const AdminCouponsScreen(),
                ),
              );
            },
          ),


        ],
      ),
    );
  }
}

class AdminUsersScreen extends StatefulWidget {
  const AdminUsersScreen({super.key});

  @override
  State<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends State<AdminUsersScreen> {
  List<Map<String, dynamic>> users = [];
  bool isLoading = true;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    fetchUsers();
  }

  Future<void> fetchUsers() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final token = await secureStorage.read(key: 'auth_token');

      if (token == null || token.isEmpty) {
        throw Exception('Please log in again as an administrator.');
      }

      final response = await http.get(
        Uri.parse('$apiUrl/auth/admin/users'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 20));

      final data = jsonDecode(response.body) as Map<String, dynamic>;

      if (response.statusCode != 200 || data['success'] != true) {
        throw Exception(data['message'] ?? 'Unable to load accounts.');
      }

      final rawUsers = data['users'] as List<dynamic>? ?? [];

      if (!mounted) return;

      setState(() {
        users = rawUsers
            .whereType<Map<String, dynamic>>()
            .toList();
        isLoading = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        errorMessage =
            error.toString().replaceFirst('Exception: ', '');
        isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Users & Vendors'),
        actions: [
          IconButton(
            tooltip: 'Refresh accounts',
            onPressed: isLoading ? null : fetchUsers,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: fetchUsers,
        child: isLoading
            ? ListView(
                children: [
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
                          onPressed: fetchUsers,
                          child: const Text('Try again'),
                        ),
                      ),
                    ],
                  )
                : users.isEmpty
                    ? ListView(
                        padding: const EdgeInsets.all(24),
                        children: const [
                          SizedBox(height: 100),
                          Icon(
                            Icons.people_outline,
                            size: 56,
                            color: Colors.grey,
                          ),
                          SizedBox(height: 16),
                          Center(
                            child: Text(
                              'No customer or vendor accounts yet.',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 16),
                            ),
                          ),
                          SizedBox(height: 8),
                          Center(
                            child: Text(
                              'Accounts will appear here when registered.',
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ],
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: users.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final user = users[index];
                          final role =
                              (user['role'] ?? 'unknown')
                                  .toString();
                          final name =
                              (user['name'] ?? 'Unnamed user')
                                  .toString();
                          final email =
                              (user['email'] ?? '').toString();
                          final phone =
                              (user['phone'] ?? '').toString();
                          final isActive = user['isActive'] == true;

                          return Card(
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: orange.withValues(
                                  alpha: 0.12,
                                ),
                                child: Icon(
                                  role == 'vendor'
                                      ? Icons.store_outlined
                                      : Icons.person_outline,
                                  color: orange,
                                ),
                              ),
                              title: Text(
                                name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              subtitle: Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    if (email.isNotEmpty)
                                      Text(email),
                                    if (phone.isNotEmpty)
                                      Text(phone),
                                    const SizedBox(height: 6),
                                    Text(
                                      '${role.toUpperCase()} • '
                                      '${isActive ? 'Active' : 'Inactive'}',
                                      style: TextStyle(
                                        color: isActive
                                            ? Colors.green.shade700
                                            : Colors.red.shade700,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              isThreeLine: email.isNotEmpty ||
                                  phone.isNotEmpty,
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}

