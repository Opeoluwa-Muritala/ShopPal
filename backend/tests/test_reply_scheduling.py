"""Regression checks for queue head-of-line blocking, without a live database."""

import asyncio
from threading import Event

from app.config import Settings
from app.services import reply_recovery as recovery


def test_free_slot_accepts_new_message_while_slow_message_is_running(monkeypatch):
    slow_started, release_slow, fast_started = Event(), Event(), Event()
    selected = []

    def ready(engine, limit, exclude):
        selected.append((limit, exclude))
        if len(selected) == 1:
            return ["slow"]
        if len(selected) == 2:
            return ["fast"]
        return []

    def process(engine, identifier, settings):
        if identifier == "slow":
            slow_started.set()
            assert release_slow.wait(5)
        else:
            fast_started.set()
        return True

    monkeypatch.setattr(recovery, "get_engine", lambda: object())
    monkeypatch.setattr(recovery, "get_settings", lambda: Settings(
        _env_file=None, meta_reply_worker_concurrency=2,
        meta_reply_worker_poll_seconds=0.5,
    ))
    monkeypatch.setattr(recovery, "ready_job_ids", ready)
    monkeypatch.setattr(recovery, "process_claim", process)

    async def run():
        stop = asyncio.Event()
        worker = asyncio.create_task(recovery.recovery_loop(stop))
        try:
            assert await asyncio.to_thread(slow_started.wait, 2)
            assert await asyncio.to_thread(fast_started.wait, 2)
            assert selected[1] == (1, ("slow",))
        finally:
            stop.set()
            release_slow.set()
            await asyncio.wait_for(worker, 3)

    asyncio.run(run())


def test_committed_message_wakeup_does_not_wait_for_poll_interval(monkeypatch):
    polled = Event()
    started = Event()
    ready = Event()

    def select_jobs(*args):
        polled.set()
        return ["new"] if ready.is_set() else []

    monkeypatch.setattr(recovery, "get_engine", lambda: object())
    monkeypatch.setattr(recovery, "get_settings", lambda: Settings(
        _env_file=None, meta_reply_worker_poll_seconds=30,
    ))
    monkeypatch.setattr(recovery, "ready_job_ids", select_jobs)
    monkeypatch.setattr(recovery, "process_claim", lambda *args: started.set())

    async def run():
        stop, wakeup = asyncio.Event(), asyncio.Event()
        worker = asyncio.create_task(recovery.recovery_loop(stop, wakeup))
        try:
            assert await asyncio.to_thread(polled.wait, 2)
            ready.set()
            wakeup.set()
            assert await asyncio.to_thread(started.wait, 2)
        finally:
            stop.set()
            await asyncio.wait_for(worker, 3)

    asyncio.run(run())
