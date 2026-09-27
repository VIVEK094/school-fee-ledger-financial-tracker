import json

from django.contrib.staticfiles.finders import find
from django.test import TestCase

from .models import FeeCollection


class FeeCollectionTests(TestCase):
    def test_fee_form_script_is_available_as_a_static_asset(self):
        response = self.client.get('/')

        self.assertContains(response, 'src="/static/finance/app.js"')
        self.assertIsNotNone(find('finance/app.js'))

    def test_collect_api_saves_payment(self):
        response = self.client.post(
            '/api/finance/collect',
            data=json.dumps({
                'student_reg_number': 'SIT2024001',
                'amount_paid': 12000,
                'payment_mode': 'UPI',
                'academic_term': '2026-27',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(FeeCollection.objects.count(), 1)

        payment = FeeCollection.objects.get()
        self.assertEqual(payment.student_reg_number, 'SIT2024001')
        self.assertEqual(payment.amount_paid, 12000)
        self.assertEqual(payment.payment_mode, 'UPI')
        self.assertEqual(payment.academic_term, '2026-27')

    def test_history_calculates_outstanding_balance_and_audit_state(self):
        response = self.client.post(
            '/api/finance/collect',
            data=json.dumps({
                'student_reg_number': 'SIT2024002',
                'amount_paid': 5000,
                'expected_fee': 20000,
                'payment_mode': 'Cash',
                'academic_term': '2026-27',
                'is_verified': False,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        transaction = response.json()['transaction']
        self.assertEqual(transaction['expected_fee'], 20000)
        self.assertEqual(transaction['outstanding_balance'], 15000)
        self.assertEqual(transaction['audit_status'], 'unverified')

        history = self.client.get('/api/finance/history').json()
        self.assertEqual(history['total_outstanding'], 15000)
        self.assertEqual(history['unverified_count'], 1)

    def test_logs_returns_only_the_ten_most_recent_transactions(self):
        for number in range(12):
            FeeCollection.objects.create(
                student_reg_number=f'SIT{number:07d}',
                amount_paid=1000 + number,
                payment_mode='UPI',
                academic_term='2026-27',
                is_verified=True,
            )

        response = self.client.get('/api/logs')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], 10)
        self.assertEqual(
            [item['id'] for item in response.json()['logs']],
            list(range(12, 2, -1)),
        )
