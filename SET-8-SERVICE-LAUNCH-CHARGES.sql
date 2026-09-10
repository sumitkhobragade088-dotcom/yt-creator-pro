-- YT Creator Pro: launch charges for the existing 8 services. No schema/layout change.
update public.service_charges set charge=199,updated_at=now() where service_name='Channel Management';
update public.service_charges set charge=299,updated_at=now() where service_name='Monetization Help';
update public.service_charges set charge=199,updated_at=now() where service_name='AdSense Assistance';
update public.service_charges set charge=99,updated_at=now() where service_name='YouTube Reporting Setup';
update public.service_charges set charge=149,updated_at=now() where service_name='YouTube Live Streaming Setup';
update public.service_charges set charge=99,updated_at=now() where service_name='YouTube Live Chat Setup / Moderation';
update public.service_charges set charge=149,updated_at=now() where service_name='YouTube Embedded Player Setup';
update public.service_charges set charge=99,updated_at=now() where service_name='YouTube oEmbed Setup';
select service_name,charge,is_active from public.service_charges order by sort_order,service_name;
