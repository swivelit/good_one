import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';

void main() {
  testWidgets('GoodOne app loads', (WidgetTester tester) async {
    await tester.pumpWidget(const GoodOneApp());

    expect(find.text('GoodOne'), findsOneWidget);
  });
}