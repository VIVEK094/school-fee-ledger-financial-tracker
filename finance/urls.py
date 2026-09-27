from django.urls import path

from . import views


urlpatterns = [
    path(
        '',
        views.index,
        name='index'
    ),

    path(
        'api/finance/history',
        views.finance_history,
        name='finance_history'
    ),

    path(
        'api/finance/collect',
        views.collect_fee,
        name='collect_fee'
    ),

    path(
        'api/logs',
        views.transaction_logs,
        name='transaction_logs'
    ),
]