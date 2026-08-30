-- Add 5 paid YouTube services to CURRENT deployed database.
-- Existing admin-set charges are preserved.
insert into public.service_charges(service_name,description,charge,is_active,sort_order)
values
 ('YouTube Reporting Setup','Set up YouTube Reporting for an access-granted channel, including reporting jobs, generated report access, dates/status and reporting configuration.',0,true,40),
 ('YouTube Live Streaming Setup','Set up and configure YouTube Live Streaming for an eligible access-granted channel, including broadcasts, streams, scheduling, binding and live controls.',0,true,41),
 ('YouTube Live Chat Setup / Moderation','Configure YouTube Live Chat management for an eligible live-enabled channel, including messages, moderators, timeout, ban and unban controls.',0,true,42),
 ('YouTube Embedded Player Setup','Set up YouTube Embedded Player for channel videos with player preview and supported playback controls.',0,true,43),
 ('YouTube oEmbed Setup','Set up YouTube oEmbed URL metadata and preview support for public YouTube videos, Shorts and live URLs.',0,true,44)
on conflict (service_name) do update
set description=excluded.description,
    is_active=true,
    sort_order=excluded.sort_order,
    updated_at=now();

select service_name,description,charge,is_active,sort_order
from public.service_charges
where service_name in (
'YouTube Reporting Setup',
'YouTube Live Streaming Setup',
'YouTube Live Chat Setup / Moderation',
'YouTube Embedded Player Setup',
'YouTube oEmbed Setup')
order by sort_order;
