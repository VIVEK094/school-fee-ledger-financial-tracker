import json

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt

from .models import FeeCollection


def _ledger_snapshot():
    records = list(FeeCollection.objects.order_by('-created_at', '-pk'))
    grouped = {}

    for transaction in reversed(records):
        key = (transaction.student_reg_number, transaction.academic_term)
        account = grouped.setdefault(key, {
            'total_paid': 0,
            'expected_fee': None,
        })
        account['total_paid'] += transaction.amount_paid
        if transaction.expected_fee is not None:
            account['expected_fee'] = transaction.expected_fee

    entries = []
    for transaction in records:
        account = grouped[(transaction.student_reg_number, transaction.academic_term)]
        expected_fee = account['expected_fee']
        balance = (
            max(expected_fee - account['total_paid'], 0)
            if expected_fee is not None else None
        )
        entries.append({
            'id': transaction.id,
            'student_reg_number': transaction.student_reg_number,
            'amount_paid': transaction.amount_paid,
            'expected_fee': expected_fee,
            'outstanding_balance': balance,
            'is_verified': transaction.is_verified,
            'audit_status': (
                'unverified' if not transaction.is_verified
                else 'arrears' if balance
                else 'verified'
            ),
            'payment_mode': transaction.payment_mode,
            'academic_term': transaction.academic_term,
            'created_at': transaction.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        })

    total_outstanding = sum(
        max(account['expected_fee'] - account['total_paid'], 0)
        for account in grouped.values()
        if account['expected_fee'] is not None
    )
    unverified_count = sum(not record.is_verified for record in records)
    unassessed_accounts = sum(
        account['expected_fee'] is None
        for account in grouped.values()
    )
    return records, entries, total_outstanding, unverified_count, unassessed_accounts


def index(request):
    return render(request, 'finance/index.html')


def finance_history(request):
    """
    GET /api/finance/history
    Returns all financial ledger entries.
    """

    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Only GET requests are allowed.'}, status=405)

    records, entries, total_outstanding, unverified_count, unassessed_accounts = _ledger_snapshot()

    return JsonResponse({
        'success': True,
        'total_transactions': len(records),
        'total_collected': sum(record.amount_paid for record in records),
        'total_outstanding': total_outstanding,
        'unverified_count': unverified_count,
        'unassessed_accounts': unassessed_accounts,
        'history': entries,
    })


@csrf_exempt
def collect_fee(request):
    """
    POST /api/finance/collect
    Creates a new fee collection record.
    """

    if request.method != 'POST':
        return JsonResponse(
            {
                'success': False,
                'message': 'Only POST requests are allowed.'
            },
            status=405
        )

    try:
        body = json.loads(request.body)

        if not isinstance(body, dict):
            return JsonResponse({'success': False, 'message': 'A JSON object is required.'}, status=400)

        student_reg_number = str(body.get('student_reg_number', '')).strip()
        amount_paid = body.get('amount_paid')
        payment_mode = body.get('payment_mode')
        academic_term = str(body.get('academic_term', '')).strip()
        expected_fee = body.get('expected_fee')
        is_verified = body.get('is_verified', False)

        # Validation
        if not student_reg_number:
            return JsonResponse({
                'success': False,
                'message': 'Student registration number is required.'
            }, status=400)

        if not amount_paid:
            return JsonResponse({
                'success': False,
                'message': 'Amount paid is required.'
            }, status=400)

        if not payment_mode:
            return JsonResponse({
                'success': False,
                'message': 'Payment mode is required.'
            }, status=400)

        if not academic_term:
            return JsonResponse({
                'success': False,
                'message': 'Academic term is required.'
            }, status=400)

        valid_payment_modes = {mode for mode, _ in FeeCollection.PAYMENT_MODES}
        if payment_mode not in valid_payment_modes:
            return JsonResponse({
                'success': False,
                'message': 'Select a valid payment mode.'
            }, status=400)

        try:
            amount_paid = int(amount_paid)
        except (ValueError, TypeError):
            return JsonResponse({
                'success': False,
                'message': 'Amount must be a valid integer.'
            }, status=400)

        if amount_paid <= 0:
            return JsonResponse({
                'success': False,
                'message': 'Amount must be greater than zero.'
            }, status=400)

        if expected_fee in (None, ''):
            expected_fee = None
        else:
            try:
                expected_fee = int(expected_fee)
            except (ValueError, TypeError):
                return JsonResponse({
                    'success': False,
                    'message': 'Expected fee must be a valid integer.'
                }, status=400)
            if expected_fee <= 0:
                return JsonResponse({
                    'success': False,
                    'message': 'Expected fee must be greater than zero.'
                }, status=400)

        if not isinstance(is_verified, bool):
            return JsonResponse({
                'success': False,
                'message': 'Verification status must be true or false.'
            }, status=400)

        transaction = FeeCollection.objects.create(
            student_reg_number=student_reg_number,
            amount_paid=amount_paid,
            payment_mode=payment_mode,
            academic_term=academic_term,
            expected_fee=expected_fee,
            is_verified=is_verified,
        )
        _, entries, _, _, _ = _ledger_snapshot()
        transaction_data = next(entry for entry in entries if entry['id'] == transaction.id)

        return JsonResponse({
            'success': True,
            'message': 'Payment recorded successfully.',
            'transaction': transaction_data,
        }, status=201)

    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'message': 'Invalid JSON data.'
        }, status=400)

    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': str(e)
        }, status=500)


def transaction_logs(request):
    """
    GET /api/logs
    Returns the latest 10 transactions.
    """

    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Only GET requests are allowed.'}, status=405)

    _, entries, _, _, _ = _ledger_snapshot()
    data = entries[:10]

    return JsonResponse({
        'success': True,
        'count': len(data),
        'logs': data
    })