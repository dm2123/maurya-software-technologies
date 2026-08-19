import 'package:flutter_test/flutter_test.dart';
import 'package:maurya_automation/main.dart';

void main() {
  testWidgets('Home screen shows app bar title', (tester) async {
    await tester.pumpWidget(const MyApp());
    expect(find.text('Maurya Automation'), findsOneWidget);
  });
}