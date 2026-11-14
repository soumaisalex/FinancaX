-- Uma ocorrência por recorrência e data (materialização preguiçosa idempotente).
create unique index transactions_recurrence_date_uq
  on transactions (recurrence_id, date) where recurrence_id is not null;
