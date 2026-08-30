-- YT Creator Pro - Launch prices for current 8 paid services
update public.service_charges set charge=199, updated_at=now() where service_name='Channel Management';
update public.service_charges set charge=299, updated_at=now() where service_name in ('Monetization Help','Monetization Application & Assistance','YouTube Monetization Application & Approval Assistance');
update public.service_charges set charge=199, updated_at=now() where service_name in ('AdSense Assistance','YouTube AdSense Setup & Assistance');
update public.service_charges set charge=99, updated_at=now() where service_name='YouTube Reporting Setup';
update public.service_charges set charge=149, updated_at=now() where service_name='YouTube Live Streaming Setup';
update public.service_charges set charge=99, updated_at=now() where service_name='YouTube Live Chat Setup / Moderation';
update public.service_charges set charge=149, updated_at=now() where service_name='YouTube Embedded Player Setup';
update public.service_charges set charge=99, updated_at=now() where service_name='YouTube oEmbed Setup';

select service_name,charge,is_active from public.service_charges
where service_name in ('Channel Management','Monetization Help','Monetization Application & Assistance','YouTube Monetization Application & Approval Assistance','AdSense Assistance','YouTube AdSense Setup & Assistance','YouTube Reporting Setup','YouTube Live Streaming Setup','YouTube Live Chat Setup / Moderation','YouTube Embedded Player Setup','YouTube oEmbed Setup')
order by sort_order,service_name;
