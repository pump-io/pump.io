# jankyqueue.js
#
# A janky in-process queue
#
# Copyright 2012, StatusNet Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# I searched npm for in-process queues; got too many results; so I added
# to the problem.
Queue = (max) ->
  @max = max
  @waiting = []
  @running = 0

Queue::enqueue = (fn, args, callback) ->
  q = this
  if q.running < q.max
    q.run fn, args, callback
  else
    q.add fn, args, callback

Queue::add = (fn, args, callback) ->
  q = this
  q.waiting.push [fn, args, callback]

Queue::run = (fn, args, callback) ->
  q = this
  wrapped = ->
    results = arguments_
    next = undefined
    q.running--
    if (q.running < q.max) and q.waiting.length > 0
      next = q.waiting.shift()
      q.run next[0], next[1], next[2]
    callback.apply null, results

  all = (if (args) then args.concat([wrapped]) else [wrapped])
  q.running++
  process.nextTick ->
    fn.apply null, all


exports.Queue = Queue
