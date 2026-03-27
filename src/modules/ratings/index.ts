/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { onEvent, USER_EVENTS } from "../../shared/event-bus";
import { RatingRepository } from "./repository";
import { RatingService } from "./service";

const ratingService = new RatingService();
const ratingRepository = new RatingRepository()

function initRatingsModule() {
    onEvent(USER_EVENTS.CREATED, async ({ userId }) => {
        ratingService.createUserRating(userId)
    })
}

export { ratingService, ratingRepository, initRatingsModule }